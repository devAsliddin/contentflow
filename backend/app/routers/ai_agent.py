"""AI Agent chat — AI that can manage posts and schedules."""
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.account import Account
from app.models.post import Post
from app.models.user import User
from app.services.ollama_client import call_ollama_chat
from app.services import credit_service
from app.services import news_service
from app.utils.timezones import LOCAL_TZ, parse_local_to_utc

logger = logging.getLogger(__name__)
router = APIRouter()

# Follow whatever model is actually configured/available (OLLAMA_MODEL in
# .env) instead of a hardcoded name — a stale literal here silently falls
# back to OpenRouter on every request once the Ollama node's model changes.
DEFAULT_MODEL = get_settings().ollama_model

# The agent reasons in the user's local time (Tashkent, UTC+5). All scheduled_at
# values the LLM emits are interpreted as this local time and converted to UTC
# before persisting (Celery ETAs run in UTC). See app.utils.timezones.


# ── Schemas ───────────────────────────────────────────────────────────────────


class AgentMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class AgentChatRequest(BaseModel):
    messages: list[AgentMessage] = Field(..., min_length=1)
    model: str = Field(default=DEFAULT_MODEL, max_length=100)
    # Optional media the user attached in chat — used as the post's image/video.
    media_url: str | None = None
    media_type: str | None = None  # "image" | "video"
    # Content format the user picked for any post created in this turn.
    content_type: Literal["post", "story", "reel"] = "post"
    # Whether to AI-generate an image when creating a post (and no media attached).
    want_image: bool = False


class AgentAction(BaseModel):
    type: str
    result: dict | None = None
    error: str | None = None


class AgentSource(BaseModel):
    title: str
    source: str
    url: str


class AgentChatResponse(BaseModel):
    message: AgentMessage
    model: str
    action: AgentAction | None = None
    # Reputable outlets the caption content was grounded on, if any.
    sources: list[AgentSource] = Field(default_factory=list)


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _call_ollama(messages: list[dict], model: str) -> str:
    # Always use a local model — strip out any OpenRouter/cloud model paths
    local_model = model if "/" not in model else DEFAULT_MODEL
    return await call_ollama_chat(messages, local_model, include_error_body=False)


def _extract_json(text: str) -> dict | None:
    """Try to extract a JSON object from LLM output."""
    text = text.strip()
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return None


# The agent is told to write times in the user's local timezone (Tashkent,
# UTC+5) with no offset suffix; parse_local_to_utc interprets them accordingly.
_parse_local_to_utc = parse_local_to_utc


def _ensure_future(dt, now):
    """Never schedule in the past. Small models sometimes emit an earlier hour
    of today; bump those to the next hour so the post actually schedules."""
    if dt is None:
        return dt
    if dt <= now:
        return now + timedelta(hours=1)
    return dt


async def _summarize_recent_posts(db: AsyncSession, user_id) -> str:
    """Review the user's recent posts so a story image can match their content.

    Returns a short text digest of recent captions/formats, or an empty string
    if the user has no posts yet. Never raises.
    """
    try:
        result = await db.execute(
            select(Post)
            .where(Post.user_id == user_id)
            .order_by(Post.created_at.desc())
            .limit(8)
        )
        posts = list(result.scalars().all())
    except Exception as exc:  # noqa: BLE001
        logger.warning("agent: review of recent posts failed user=%s: %s", user_id, exc)
        return ""

    lines: list[str] = []
    for p in posts:
        caption = (p.caption or "").strip().replace("\n", " ")
        if not caption:
            continue
        lines.append(f"- {caption[:120]}")
    return "\n".join(lines[:6])


def _placement_options(content_type: str) -> dict[str, dict[str, str]]:
    """Map content type (post/story/reel) → Post.platform_options for Instagram."""
    if content_type == "story":
        return {"instagram": {"placement": "story", "aspect_ratio": "9:16"}}
    if content_type == "reel":
        return {"instagram": {"placement": "reel", "aspect_ratio": "9:16"}}
    return {"instagram": {"placement": "feed", "aspect_ratio": "1:1"}}


_HASHTAG_RE = re.compile(r"#\S+")
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F1E6-\U0001F1FF"
    "\U0000FE00-\U0000FE0F"  # variation selectors (e.g. the ️ after ⚡/⚽)
    "]+"
)


def _clean_caption_for_image_prompt(caption: str) -> str:
    """Strip hashtags/emoji before using the caption as an image theme.

    Hashtags in particular can derail the image: a caption mentioning both
    a football-piracy story and a ransomware story tagged "#FIFA2026
    #ransomware" produced a stadium photo instead of anything security-
    related, because the raw caption text (hashtags included) was handed
    straight to the image prompt.
    """
    text = _HASHTAG_RE.sub("", caption)
    text = _EMOJI_RE.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


async def _generate_post_image(
    caption: str,
    content_type: str,
    user_id: str,
    post_context: str = "",
    image_prompt: str | None = None,
) -> str | None:
    """Best-effort AI image for a chat-created post. Returns a /media URL or None.

    `post_context` is a digest of the user's recent posts (see
    `_summarize_recent_posts`); when present it grounds the image in the
    account's existing content so a generated story fits their style.

    `image_prompt` should be an LLM-written English visual description (see
    the system prompt's "image_prompt" field). The image generator barely
    understands non-English text — a raw Uzbek caption about a VPN breach
    produced an unrelated husky-in-the-snow photo, while an equivalent
    English description of the same story produced an accurate padlock/
    circuit-board image. Falls back to the (still hashtag/emoji-stripped)
    caption when the LLM didn't provide one, e.g. for older callers.

    Never raises — if no image provider is configured or generation fails, the
    post is still created without an image.
    """
    import uuid as _uuid
    from app.services.images.router import generate_image
    from app.services.images.storage import save_generated_image

    # Vertical 9:16 canvas for story/reel, square for feed posts.
    if content_type in ("story", "reel"):
        width, height = 768, 1344
    else:
        width, height = 1024, 1024

    theme = _clean_caption_for_image_prompt(image_prompt or caption)
    prompt = (
        "Professional, high-quality social media photo. No text, words or lettering anywhere. "
        f"Theme: {theme[:180]}"
    )
    if post_context:
        prompt += (
            " Match the visual style and topics of the account's recent posts:\n"
            f"{post_context[:400]}"
        )
    try:
        result = await generate_image(prompt=prompt, width=width, height=height)
        _, media_url = save_generated_image(result.image_bytes, user_id, str(_uuid.uuid4()))
        return media_url
    except Exception as exc:  # noqa: BLE001
        logger.warning("agent: image generation skipped/failed user=%s: %s", user_id, exc)
        return None


def _format_schedule(posts: list[Post]) -> str:
    if not posts:
        return "Hozircha rejalashtirilgan postlar yo'q."
    lines = []
    for i, p in enumerate(posts, 1):
        if p.scheduled_at:
            local = p.scheduled_at
            # DB stores tz-aware UTC; show it in the user's local timezone.
            if local.tzinfo is not None:
                local = local.astimezone(LOCAL_TZ)
            sched = local.strftime("%Y-%m-%d %H:%M")
        else:
            sched = "Rejalashtirilmagan"
        plats = ", ".join(p.platforms or [])
        caption_short = (p.caption or "")[:60]
        if len(p.caption or "") > 60:
            caption_short += "..."
        lines.append(f"[{i}] [{p.status.upper()}] {sched} | {plats} | {caption_short}")
    return "\n".join(lines)


def _build_system_prompt(accounts: list[dict], upcoming: list[Post], now: datetime) -> str:
    account_lines = "\n".join(
        f"  - {a['platform'].capitalize()}: @{a['account_name']}" for a in accounts
    ) or "  Hozircha ulangan platformalar yo'q."

    schedule_text = _format_schedule(upcoming)
    now_local = now.astimezone(LOCAL_TZ) if now.tzinfo else now
    manager_rules = f"""
Hozirgi mahalliy vaqt (Toshkent, UTC+5): {now_local.strftime("%Y-%m-%d %H:%M")}
Barcha vaqtlar Toshkent mahalliy vaqtida. scheduled_at ni mahalliy vaqtda yozing (vaqt mintaqasi qo'shimchasisiz, masalan "2026-06-25T18:00:00").

Siz oddiy chat emassiz. Siz ContentFlow AI Menejeri sifatida ishlaysiz:
1. Haftasiga nechta post kerakligini tavsiya qilasiz.
2. Qaysi kunlari post qo'yish yaxshi ekanini tanlaysiz.
3. Har kun uchun formatni belgilaysiz: Reels, carousel, story, tutorial, case, offer, behind-the-scenes, poll, live reminder.
4. Rejalashtirilgan postlar bilan to'qnashmaslikka harakat qilasiz.
5. Foydalanuvchi "reja tuz", "haftalik plan", "qaysi kunlar yaxshi" desa, javobda aniq haftalik jadval bering.

Platforma bo'yicha tavsiya asoslari:
- Instagram: haftasiga 4-5 post. Dushanba educational carousel, seshanba Reels/hook, chorshanba proof/case, juma offer/savdo posti, shanba behind-the-scenes yoki community. Eng yaxshi vaqtlar: 11:00-13:00 yoki 18:00-21:00.
- TikTok: haftasiga 3-5 qisqa video. Seshanba, payshanba, shanba kuchli kunlar. Format: hook + tez yechim + CTA. Eng yaxshi vaqtlar: 19:00-22:00.
- Telegram: haftasiga 5-7 post. Dushanba reja, seshanba foydali maslahat, chorshanba mini case, payshanba savol-javob/poll, juma taklif, yakshanba recap. Eng yaxshi vaqtlar: 09:00-10:00, 13:00-14:00, 20:00-22:00.

Javob uslubi:
- Foydalanuvchi qaysi tilda yozsa, shu tilda javob bering.
- Ravon o'zbek lotinida yozing, g'alati tarjima yoki buzilgan so'z ishlatmang.
- Qisqa, amaliy va jadval ko'rinishida javob bering.
- Reja berganda har qatorda: kun, platforma, format, mavzu, qisqa caption yo'nalishi, vaqt, maqsad.
- Agar platforma ulanmagan bo'lsa, buni yumshoq ayting va ulashni tavsiya qiling, lekin strategik reja berishda davom eting.
"""

    return f"""Siz ContentFlow AI Agent — professional SMM yordamchi va post menejeri.

Foydalanuvchining ulangan platformalari:
{account_lines}

Rejalashtirilgan / kutilayotgan postlar:
{schedule_text}

{manager_rules}

Siz quyidagi amallarni bajara olasiz:
1. Postlar va jadval haqida ma'lumot berish
2. Yangi post yaratish (foydalanuvchi so'raganda)
3. Post rejalashtirish vaqtini belgilash
4. Kontent tavsiya qilish
5. Haftalik/oylik content reja tuzish va kalendarga qo'shish
6. Rejalashtirilgan postni O'CHIRISH (kalendardan olib tashlash)
7. Rejalashtirilgan post vaqtini O'ZGARTIRISH (boshqa kunga/vaqtga, jumladan oldingi kunga ko'chirish)
8. So'nggi yangiliklarni topib, qaysi mavzu ko'proq like/engagement olishini tahlil qilish

ISHLASH TARTIBI — AVVAL TAKLIF, KEYIN TASDIQ (JUDA MUHIM):
- Foydalanuvchi post/reja yaratishni so'raganda, DARHOL create_post/create_plan JSON chiqarmang. Avval taklifingizni MATN bilan bering: caption(lar), format va taklif qilingan KELAJAK sana/vaqt. So'ngra tasdiq so'rang, masalan: "Shu postni 21-iyul 18:00 ga Instagram'ga rejalashtiraymi? Tasdiqlang." Bu bosqichda "action": "none" qaytaring.
- FAQAT foydalanuvchi tasdiqlaganidan keyin (masalan "ha", "xa", "ok", "mayli", "qo'y", "joyla", "tasdiqla", "davom et") — javob oxirida create_post yoki create_plan JSON blokini chiqaring.
- Bitta aniq taklif bering, foydalanuvchini ortiqcha savolga ko'mmang. Caption va mavzuni o'zingiz tayyorlang.

MAʼLUMOTGA ASOSLANISH (MUHIM):
- Agar quyida "ISHONCHLI MANBALAR" bloki bo'lsa, faqat o'shandagi HAQIQIY faktlar/sarlavhalarga asoslanib yozing. HECH QACHON "internetga kirishim yo'q" yoki "aniqlay olmayman" demang — sizga eng so'nggi manbalar berilgan.
- Manba berilmagan bo'lsa, aniqmas umumlashmalardan ("so'nggi hafta yangiliklari") saqlaning va foydalanuvchidan mavzuni aniqlashtiring.
- Manbalar bir nechta bo'lsa ham, caption FAQAT BITTA voqea/xabarga asoslansin — eng dolzarb va foydalanuvchi so'ragan mavzuga eng mos bittasini tanlang. Bir nechta turli xabarni (masalan sport va kiberxavfsizlik) BITTA captionda ARALASHTIRMANG — bu chalkash va tushunarsiz matn hosil qiladi.
- Caption FAQAT o'zbek lotin alifbosida bo'lsin. Boshqa til/alifbo (kirill, xitoy, arab va h.k.) so'z yoki belgilarini ARALASHTIRMANG — manba ingliz tilida bo'lsa ham, o'zingiz toza o'zbekchaga o'giring.

KONTEKSTNI CHUQUR TUSHUNING (MUHIM):
- Foydalanuvchi to'g'ridan "yangilik top" demasa ham, NIYATINI tushuning. Masalan "o'tgan haftada qanday yangiliklar bor", "qaysi yangilik bilan akkauntim uchadi", "qaysi mavzu ko'proq like yig'adi", "nima viral bo'ladi", "trendda nima bor", "engagement uchun nima yozay" kabi savollar — bularning hammasida sizga berilgan ISHONCHLI MANBALARdan foydalanib, real yangiliklar asosida javob bering.
- Bunday savolga: (1) manbalardagi eng dolzarb 2-3 mavzuni sanang, (2) qaysi biri Instagram auditoriyasini ko'proq jalb qilishi (like/izoh/ulashish) mumkinligini qisqa izohlang, (3) so'ng post taklif qiling va tasdiq so'rang.
- "Oddiy odam" tilida yozing — sodda, tushunarli, ortiqcha texnik atamasiz.

SANA QOIDASI (MUHIM):
- Barcha scheduled_at HOZIRGI VAQTDAN KEYIN bo'lishi SHART. Hech qachon o'tmishdagi sana bermang. Aniq vaqt berilmasa eng yaqin mos KELAJAK kun/vaqtni tanlang.

MUHIM — Foydalanuvchi BITTA postni TASDIQLAGANDA, javob oxirida:
```json
{{"action": "create_post", "caption": "post matni", "image_prompt": "English visual description for the image generator", "platforms": ["instagram"], "scheduled_at": "2026-05-16T18:00:00"}}
```

MUHIM — Foydalanuvchi REJANI (haftalik/oylik/ko'p postli) TASDIQLAGANDA, javob oxirida:
```json
{{"action": "create_plan", "posts": [{{"caption": "post 1 matni", "image_prompt": "English visual description", "platforms": ["instagram"], "scheduled_at": "2026-05-17T11:00:00", "format": "carousel", "topic": "mavzu"}}, {{"caption": "post 2 matni", "image_prompt": "English visual description", "platforms": ["telegram"], "scheduled_at": "2026-05-18T09:00:00", "format": "text", "topic": "mavzu"}}]}}
```

`image_prompt` HAR DOIM ANGLIYCHA yozilsin (caption tili qanday bo'lishidan qat'i nazar) — rasm generatori faqat inglizcha tavsiflarni to'g'ri tushunadi, o'zbekcha/rus tilidagi so'zlarni berilsa noto'g'ri yoki mavzuga aloqasiz rasm chiqarib beradi. Aniq, ko'rgazmali obyekt/sahna nomlari bilan yozing (masalan "digital padlock on a circuit board, red warning lights, cybersecurity concept" — "post about VPN security" kabi mavhum emas).

POSTNI O'CHIRISH — Foydalanuvchi kalendardan/jadvaldan postni o'chirishni so'rab TASDIQLAGANDA. Yuqoridagi "Rejalashtirilgan / kutilayotgan postlar" ro'yxatidagi [N] raqamidan foydalaning:
```json
{{"action": "delete_post", "index": 2}}
```

POSTNI QAYTA REJALASH — Foydalanuvchi post vaqtini o'zgartirishni (boshqa kunga/vaqtga, jumladan oldingi kunga) so'rab TASDIQLAGANDA. [N] raqami + yangi vaqt:
```json
{{"action": "reschedule_post", "index": 2, "scheduled_at": "2026-05-19T09:00:00"}}
```

RASM PREVIEW — Foydalanuvchi postni TASDIQLASHDAN OLDIN rasmni ko'rishni/preview qilishni so'raganda ("rasmni ko'rsat", "rasmni ko'rmoqchiman", "avval rasmni ko'ray", "preview qil", "rasmga qara"). Bu amal HAQIQIY rasm generatsiya qilib qaytaradi — matn bilan tasvirlab BERMANG, har doim shu action'ni chiqaring. `caption` maydoniga oldin taklif qilgan (yoki foydalanuvchi tasdiqlagan) caption matnini AYNAN shu holicha, `image_prompt` maydoniga esa YUQORIDAGI qoidaga ko'ra ANGLIYCHA vizual tavsif qo'ying:
```json
{{"action": "preview_image", "caption": "<taklif qilingan caption matni>", "image_prompt": "English visual description for the image generator"}}
```
Preview ko'rsatilgach, foydalanuvchi tasdiqlasa create_post/create_plan chiqaring — bir xil caption va image_prompt'dan foydalaning, rasm postga avtomatik biriktiriladi.

Yoki faqat ma'lumot berayotgan bo'lsangiz:
```json
{{"action": "none"}}
```

Qoidalar:
- Foydalanuvchi qaysi tilda yozsa, shu tilda javob bering
- Jadval ko'rsatishda hozirgi vaqtdan keyingi postlarni ko'rsating
- Post yaratishda platforms ro'yxatida faqat ulangan platformalarni ishlating; platforma ulanmagan bo'lsa barcha platformalar uchun yozing
- Agar foydalanuvchi aniq sana bermasa, yuqoridagi eng yaxshi kun/vaqt qoidalaridan foydalaning
- scheduled_at ISO 8601 formatida va Toshkent mahalliy vaqtida bo'lishi kerak (vaqt mintaqasi qo'shimchasisiz)
- create_plan da kamida 5-7 post bo'lsin, har bir kun uchun aniq vaqt va caption bering

NAMUNA (faqat TARTIBNI ko'rsatadi — matnni AYNAN ko'chirmang, har doim mavzuga mos original caption yozing):
Foydalanuvchi: "Kitob do'konim haqida post yoz"
Siz: Taklif — caption: "<mavzuga mos qisqa, jonli post matni + 2-3 hashtag>". Buni ertaga 18:00 ga Instagram'ga rejalashtiraymi? Tasdiqlang.
```json
{{"action": "none"}}
```
Foydalanuvchi: "ha, qo'y"
Siz: Rejalashtiryapman ✅
```json
{{"action": "create_post", "caption": "<mavzuga mos yakuniy post matni>", "image_prompt": "<English visual description>", "platforms": ["instagram"], "scheduled_at": "<kelajakdagi ISO sana-vaqt>"}}
```

NAMUNA — RASM PREVIEW:
Foydalanuvchi: "yoq rasmni ko'rsat, joylashdan oldin ko'rmoqchiman"
Siz: Mana taklif qilingan rasm 👇
```json
{{"action": "preview_image", "caption": "<oldin taklif qilingan caption matni AYNAN shu holicha>", "image_prompt": "<English visual description>"}}
```
Foydalanuvchi: "ha tasdiqlayman, qo'y"
Siz: Rejalashtiryapman ✅
```json
{{"action": "create_post", "caption": "<xuddi shu caption matni>", "image_prompt": "<xuddi shu image_prompt>", "platforms": ["instagram"], "scheduled_at": "<kelajakdagi ISO sana-vaqt>"}}
```

AMALNI TO'G'RI TANLASH (JUDA MUHIM):
- "o'chir", "o'chirib tashla", "olib tashla", "bekor qil", "kerak emas" + MAVJUD post → delete_post (index bilan). create_post EMAS.
- "o'tkaz", "ko'chir", "vaqtini o'zgartir", "boshqa kunga/vaqtga", "oldingi kunga", "kechroq", "ertaroq" + MAVJUD post → reschedule_post (index + yangi scheduled_at). create_post EMAS va yangi post yaratMANG.
- "rasmni ko'rsat/ko'rmoqchiman/preview" → preview_image. Bu hali TASDIQ EMAS — create_post chiqarMANG, faqat rasmni ko'rsating va qayta tasdiq so'rang.
- Faqat butunlay yangi mavzu so'ralganda create_post ishlating.

NAMUNA — O'CHIRISH:
Foydalanuvchi: "birinchi postni o'chir"
Siz: [1]-post ("<qisqa caption>") ni o'chiraymi? Tasdiqlang.
```json
{{"action": "none"}}
```
Foydalanuvchi: "ha o'chir"
Siz: O'chirildi ✅
```json
{{"action": "delete_post", "index": 1}}
```

NAMUNA — VAQTINI O'ZGARTIRISH (qayta rejalash):
Foydalanuvchi: "birinchi postni 25-iyul 10:00 ga o'tkaz"
Siz: [1]-postni 25-iyul 10:00 ga ko'chiraymi? Tasdiqlang.
```json
{{"action": "none"}}
```
Foydalanuvchi: "ha o'tkaz"
Siz: Vaqti o'zgartirildi ✅
```json
{{"action": "reschedule_post", "index": 1, "scheduled_at": "2026-07-25T10:00:00"}}
```"""


# ── Reliable-source grounding ──────────────────────────────────────────────────
# When the user asks to create content about news / a topic, pull recent items
# from reputable outlets so the agent uses real facts instead of guessing.
#
# Matching is by STEM PREFIX, not exact word, because Uzbek is agglutinative:
# "yangiliklarni", "yangilikni", "yangiliklardan" must all match the stem
# "yangilik" the same way "yangilik" itself does. Exact-set membership missed
# every inflected form and silently made the agent claim it "has no sources".
_WEB_TRIGGER_WORDS = frozenset({
    "yangilik", "yangi", "so'nggi", "songgi", "bugungi",
    "trend", "xabar", "haqida", "mavzu",
    "news", "latest", "recent", "today", "trending", "update",
    "breaking", "manba", "hafta",
})
_CREATE_WORDS = frozenset({
    "post", "joyla", "reja", "plan",
    "content", "kontent", "yoz", "tayyorla", "create",
    "story", "reel", "carousel",
})
# Engagement / virality intent — a normal user asking which news would get more
# likes / go viral still wants us to look at real current news.
_ENGAGEMENT_WORDS = frozenset({
    "like", "layk", "laik", "uchadi", "uchish",
    "viral", "mashhur", "ommabop", "engagement", "jalb", "izoh",
    "komment", "top", "ko'proq", "koproq", "eng",
    "qiziqarli", "auditoriya", "obuna", "follower",
})
# Question / request words — "qanday yangiliklar bor", "yangilikni toping",
# "menga bering" style asks all signal the user wants an actual answer/lookup,
# not just a schedule-management command.
_QUESTION_WORDS = frozenset({
    "qanday", "qaysi", "nima", "qanaqa", "qachon", "qanchalik",
    "top", "izla", "qidir", "ber", "yubor", "ayt", "korsat", "ko'rsat", "bil",
})


def _normalize_uz(text: str) -> str:
    """Collapse the several Unicode look-alikes for oʻ/gʻ's apostrophe into one.

    Real Uzbek text (typed on phones, pasted from other apps) mixes the
    modifier letter U+02BB (ʻ), right single quote U+2019 (’), left single
    quote U+2018 (‘) and the plain ASCII apostrophe for the same sound.
    A word list written with one of these never matched the others.
    """
    for ch in ("‘", "’", "ʻ", "ʼ", "ʽ", "`"):
        text = text.replace(ch, "'")
    return text


def _wants_web_sources(text: str) -> bool:
    low = _normalize_uz(text.lower())
    words = re.findall(r"[\w']+", low)

    def _hits(stems: frozenset[str]) -> bool:
        return any(w.startswith(s) for w in words for s in stems)

    if not _hits(_WEB_TRIGGER_WORDS):
        return False
    # Fetch when the user wants to create content, is asking about news, or is
    # asking/requesting which topic/news would perform best (likes / virality).
    return _hits(_CREATE_WORDS) or _hits(_ENGAGEMENT_WORDS) or _hits(_QUESTION_WORDS)


def _extract_topic(text: str) -> str:
    normalized = _normalize_uz(text)
    low = normalized.lower()
    for marker in (" haqida", " mavzusida", " mavzuda", " bo'yicha", " yuzasidan", " about ", " on "):
        idx = low.find(marker)
        if idx > 0:
            return normalized[:idx].strip()[-80:]
    return text.strip()[:120]


async def _fetch_reliable_sources(text: str) -> list:
    topic = _extract_topic(text)
    try:
        return await news_service.fetch_news(topic=topic, limit=6)
    except Exception as exc:  # noqa: BLE001
        logger.warning("agent: reliable-source fetch failed: %s", exc)
        return []


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/agent-chat", response_model=AgentChatResponse)
async def agent_chat(
    data: AgentChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI Agent — can read schedule and create/schedule posts via natural language."""
    # Load accounts
    acc_result = await db.execute(
        select(Account).where(Account.user_id == current_user.id, Account.is_active == True)
    )
    account_rows = list(acc_result.scalars().all())
    accounts = [
        {"platform": a.platform, "account_name": a.account_name}
        for a in account_rows
    ]
    # First active account id per platform — used to build publishable targets.
    platform_account: dict[str, str] = {}
    for a in account_rows:
        platform_account.setdefault(a.platform, str(a.id))

    # Load upcoming posts (scheduled or draft)
    now = datetime.now(timezone.utc)
    post_result = await db.execute(
        select(Post)
        .where(
            Post.user_id == current_user.id,
            Post.status.in_(["draft", "scheduled"]),
        )
        .order_by(Post.scheduled_at.asc().nullslast())
        .limit(20)
    )
    upcoming = list(post_result.scalars().all())

    system_prompt = _build_system_prompt(accounts, upcoming, now)

    # Ground content in reputable sources when the user asks to create posts about
    # a topic / news, so captions use real facts instead of "I have no internet".
    sources_items: list = []
    last_user_msg = next(
        (m.content for m in reversed(data.messages) if m.role == "user"), ""
    )
    if last_user_msg and _wants_web_sources(last_user_msg):
        sources_items = await _fetch_reliable_sources(last_user_msg)
        if sources_items:
            system_prompt += "\n\n" + news_service.build_sources_block(sources_items)

    # If the user attached a media file in chat, tell the agent it's available so
    # it creates a post using it (the file is auto-attached server-side).
    if data.media_url:
        system_prompt += (
            f"\n\nThe user has attached a {data.media_type or 'media'} file that is "
            f"ready to be posted. When you create_post, this file will be attached "
            f"automatically — schedule the post for the requested day/time."
        )

    messages = [m.model_dump() for m in data.messages]
    messages = [m for m in messages if m.get("role") != "system"]
    all_messages = [{"role": "system", "content": system_prompt}] + messages

    await credit_service.consume(db, current_user, "agent_chat")
    raw_text = await _call_ollama(all_messages, data.model)

    # Parse action from response
    action: AgentAction | None = None
    display_text = raw_text

    parsed = _extract_json(raw_text)
    if parsed and "action" in parsed:
        action_type = parsed.get("action", "none")

        if action_type == "create_post":
            try:
                caption = parsed.get("caption", "")
                raw_platforms = parsed.get("platforms", [a["platform"] for a in accounts])
                # Convert platform names to publishable "platform:account_id" targets
                # so the scheduled post can actually be published with the media.
                platforms = []
                for p in raw_platforms:
                    p = str(p)
                    if ":" in p:
                        platforms.append(p)
                    elif p in platform_account:
                        platforms.append(f"{p}:{platform_account[p]}")
                    else:
                        platforms.append(p)
                scheduled_at_str = parsed.get("scheduled_at")
                # Interpret the LLM's time as local (Tashkent) and store UTC.
                scheduled_at = _parse_local_to_utc(scheduled_at_str)
                scheduled_at = _ensure_future(scheduled_at, now)

                # Media: prefer what the user attached; otherwise optionally
                # generate an image when the user asked for one.
                media_url = data.media_url
                media_type = data.media_type
                image_generated = False
                if not media_url and data.want_image and caption:
                    # For a story, first review the account's recent posts so the
                    # generated image matches their existing content, then generate.
                    post_context = ""
                    if data.content_type == "story":
                        post_context = await _summarize_recent_posts(db, current_user.id)
                    await credit_service.consume(db, current_user, "image")
                    gen_url = await _generate_post_image(
                        caption, data.content_type, str(current_user.id), post_context,
                        image_prompt=parsed.get("image_prompt"),
                    )
                    if gen_url:
                        media_url = gen_url
                        media_type = "image"
                        image_generated = True

                post = Post(
                    user_id=current_user.id,
                    caption=caption,
                    platforms=platforms,
                    scheduled_at=scheduled_at,
                    status="scheduled" if scheduled_at else "draft",
                    # Attach the media (uploaded or AI-generated), if any.
                    media_url=media_url,
                    media_type=media_type,
                    # Carry the chosen content type into Instagram placement.
                    platform_options=_placement_options(data.content_type),
                )
                db.add(post)
                await db.flush()
                await db.refresh(post)

                action = AgentAction(
                    type="create_post",
                    result={
                        "post_id": str(post.id),
                        "caption": caption[:80],
                        "platforms": platforms,
                        "scheduled_at": scheduled_at_str,
                        "status": post.status,
                        "content_type": data.content_type,
                        "image_generated": image_generated,
                        "media_url": media_url,
                        "reviewed_recent_posts": bool(
                            data.content_type == "story" and image_generated
                        ),
                    },
                )
                # Remove JSON from display text
                display_text = re.sub(r"```json[\s\S]*?```", "", raw_text).strip()
                if not display_text:
                    sched_label = f"{scheduled_at_str} da" if scheduled_at_str else "draft sifatida"
                    display_text = f"Post yaratildi va {sched_label} rejalashtirildi."

            except Exception as e:
                logger.error("Agent create_post failed: %s", e)
                action = AgentAction(type="create_post", error=str(e))
                display_text = re.sub(r"```json[\s\S]*?```", "", raw_text).strip()

        elif action_type == "preview_image":
            try:
                caption = parsed.get("caption", "") or last_user_msg
                post_context = ""
                if data.content_type == "story":
                    post_context = await _summarize_recent_posts(db, current_user.id)
                await credit_service.consume(db, current_user, "image")
                gen_url = await _generate_post_image(
                    caption, data.content_type, str(current_user.id), post_context,
                    image_prompt=parsed.get("image_prompt"),
                )
                display_text = re.sub(r"```json[\s\S]*?```", "", raw_text).strip()
                if gen_url:
                    action = AgentAction(
                        type="preview_image",
                        result={"image_url": gen_url, "caption": caption, "content_type": data.content_type},
                    )
                    if not display_text:
                        display_text = "Mana taklif qilingan rasm 👇 Shu holicha joylaymi?"
                else:
                    action = AgentAction(type="preview_image", error="Rasm generatsiya qilib bo'lmadi")
                    if not display_text:
                        display_text = "Kechirasiz, rasmni generatsiya qila olmadim — birozdan keyin qayta urinib ko'ring."

            except Exception as e:
                logger.error("Agent preview_image failed: %s", e)
                action = AgentAction(type="preview_image", error=str(e))
                display_text = re.sub(r"```json[\s\S]*?```", "", raw_text).strip()

        elif action_type == "create_plan":
            try:
                posts_data = parsed.get("posts", [])
                if not posts_data:
                    raise ValueError("posts list is empty")

                created_posts = []
                for item in posts_data:
                    caption = item.get("caption", "")
                    platforms = item.get("platforms", [a["platform"] for a in accounts])
                    scheduled_at_str = item.get("scheduled_at")
                    fmt = item.get("format", "")
                    topic = item.get("topic", "")

                    # Interpret the LLM's time as local (Tashkent) and store UTC.
                    scheduled_at = _parse_local_to_utc(scheduled_at_str)
                    scheduled_at = _ensure_future(scheduled_at, now)

                    post = Post(
                        user_id=current_user.id,
                        caption=caption,
                        platforms=platforms,
                        scheduled_at=scheduled_at,
                        status="scheduled" if scheduled_at else "draft",
                    )
                    db.add(post)
                    await db.flush()
                    await db.refresh(post)

                    created_posts.append({
                        "post_id": str(post.id),
                        "caption": caption[:80],
                        "platforms": platforms,
                        "scheduled_at": scheduled_at_str,
                        "format": fmt,
                        "topic": topic,
                        "status": post.status,
                    })

                action = AgentAction(
                    type="create_plan",
                    result={"posts": created_posts, "count": len(created_posts)},
                )
                display_text = re.sub(r"```json[\s\S]*?```", "", raw_text).strip()
                if not display_text:
                    display_text = f"{len(created_posts)} ta post yaratildi va kalendarga qo'shildi."

            except Exception as e:
                logger.error("Agent create_plan failed: %s", e)
                action = AgentAction(type="create_plan", error=str(e))
                display_text = re.sub(r"```json[\s\S]*?```", "", raw_text).strip()
        elif action_type == "delete_post":
            try:
                idx = int(parsed.get("index", 0))
                if idx < 1 or idx > len(upcoming):
                    raise ValueError(f"index {idx} ro'yxatda yo'q (1..{len(upcoming)})")
                target = upcoming[idx - 1]
                cap = (target.caption or "")[:60]
                # Clear FK-referencing logs first (post_logs → posts is RESTRICT).
                await db.execute(
                    text("DELETE FROM post_logs WHERE post_id = CAST(:pid AS uuid)"),
                    {"pid": str(target.id)},
                )
                await db.delete(target)
                await db.flush()
                action = AgentAction(
                    type="delete_post",
                    result={"deleted_index": idx, "caption": cap},
                )
                display_text = re.sub(r"```json[\s\S]*?```", "", raw_text).strip()
                if not display_text:
                    display_text = f"Post o'chirildi: {cap}"
            except Exception as e:
                logger.error("Agent delete_post failed: %s", e)
                action = AgentAction(type="delete_post", error=str(e))
                display_text = re.sub(r"```json[\s\S]*?```", "", raw_text).strip()

        elif action_type == "reschedule_post":
            try:
                idx = int(parsed.get("index", 0))
                if idx < 1 or idx > len(upcoming):
                    raise ValueError(f"index {idx} ro'yxatda yo'q (1..{len(upcoming)})")
                target = upcoming[idx - 1]
                new_dt = _ensure_future(_parse_local_to_utc(parsed.get("scheduled_at")), now)
                target.scheduled_at = new_dt
                target.status = "scheduled"
                await db.flush()
                lbl = new_dt.astimezone(LOCAL_TZ).strftime("%Y-%m-%d %H:%M") if new_dt else "?"
                action = AgentAction(
                    type="reschedule_post",
                    result={"index": idx, "scheduled_at": lbl, "caption": (target.caption or "")[:60]},
                )
                display_text = re.sub(r"```json[\s\S]*?```", "", raw_text).strip()
                if not display_text:
                    display_text = f"Post vaqti o'zgartirildi: {lbl}"
            except Exception as e:
                logger.error("Agent reschedule_post failed: %s", e)
                action = AgentAction(type="reschedule_post", error=str(e))
                display_text = re.sub(r"```json[\s\S]*?```", "", raw_text).strip()

        else:
            action = AgentAction(type="none")
            display_text = re.sub(r"```json[\s\S]*?```", "", raw_text).strip()

    return AgentChatResponse(
        message=AgentMessage(role="assistant", content=display_text or raw_text),
        model=data.model,
        action=action,
        sources=[
            AgentSource(title=it.title, source=it.source, url=it.url)
            for it in sources_items
        ],
    )
