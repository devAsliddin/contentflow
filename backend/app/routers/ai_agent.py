"""AI Agent chat — AI that can manage posts and schedules."""
import json
import logging
import re
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.account import Account
from app.models.post import Post
from app.models.user import User
from app.services.ollama_client import call_ollama_chat

logger = logging.getLogger(__name__)
router = APIRouter()

DEFAULT_MODEL = "qwen2.5:0.5b"


# ── Schemas ───────────────────────────────────────────────────────────────────


class AgentMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class AgentChatRequest(BaseModel):
    messages: list[AgentMessage] = Field(..., min_length=1)
    model: str = Field(default=DEFAULT_MODEL, max_length=100)


class AgentAction(BaseModel):
    type: str
    result: dict | None = None
    error: str | None = None


class AgentChatResponse(BaseModel):
    message: AgentMessage
    model: str
    action: AgentAction | None = None


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


def _format_schedule(posts: list[Post]) -> str:
    if not posts:
        return "Hozircha rejalashtirilgan postlar yo'q."
    lines = []
    for p in posts:
        sched = p.scheduled_at.strftime("%Y-%m-%d %H:%M") if p.scheduled_at else "Rejalashtirilmagan"
        plats = ", ".join(p.platforms or [])
        caption_short = (p.caption or "")[:60]
        if len(p.caption or "") > 60:
            caption_short += "..."
        lines.append(f"- [{p.status.upper()}] {sched} | {plats} | {caption_short}")
    return "\n".join(lines)


def _build_system_prompt(accounts: list[dict], upcoming: list[Post], now: datetime) -> str:
    account_lines = "\n".join(
        f"  - {a['platform'].capitalize()}: @{a['account_name']}" for a in accounts
    ) or "  Hozircha ulangan platformalar yo'q."

    schedule_text = _format_schedule(upcoming)
    manager_rules = f"""
Hozirgi vaqt: {now.isoformat()}

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
2. Yangi post yaratish buyrug'i (foydalanuvchi so'raganda)
3. Post rejalashtirish vaqtini belgilash
4. Kontent tavsiya qilish
5. Haftalik/oylik content reja tuzish va kalendarga qo'shish

MUHIM — Foydalanuvchi BITTA post yaratishni so'rasa, javob oxirida:
```json
{{"action": "create_post", "caption": "post matni", "platforms": ["instagram"], "scheduled_at": "2026-05-16T18:00:00"}}
```

MUHIM — Foydalanuvchi REJA (haftalik/oylik/ko'p postli) yaratishni so'rasa yoki "reja tuz", "jadval tuz", "7 kun", "haftalik plan" kabi so'z ishlatsa, javob oxirida:
```json
{{"action": "create_plan", "posts": [{{"caption": "post 1 matni", "platforms": ["instagram"], "scheduled_at": "2026-05-17T11:00:00", "format": "carousel", "topic": "mavzu"}}, {{"caption": "post 2 matni", "platforms": ["telegram"], "scheduled_at": "2026-05-18T09:00:00", "format": "text", "topic": "mavzu"}}]}}
```

Yoki faqat ma'lumot berayotgan bo'lsangiz:
```json
{{"action": "none"}}
```

Qoidalar:
- Foydalanuvchi qaysi tilda yozsa, shu tilda javob bering
- Jadval ko'rsatishda hozirgi vaqtdan keyingi postlarni ko'rsating
- Post yaratishda platforms ro'yxatida faqat ulangan platformalarni ishlating; platforma ulanmagan bo'lsa barcha platformalar uchun yozing
- Agar foydalanuvchi aniq sana bermasa, yuqoridagi eng yaxshi kun/vaqt qoidalaridan foydalaning
- scheduled_at ISO 8601 formatida bo'lishi kerak
- create_plan da kamida 5-7 post bo'lsin, har bir kun uchun aniq vaqt va caption bering"""


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
    accounts = [
        {"platform": a.platform, "account_name": a.account_name}
        for a in acc_result.scalars().all()
    ]

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

    messages = [m.model_dump() for m in data.messages]
    messages = [m for m in messages if m.get("role") != "system"]
    all_messages = [{"role": "system", "content": system_prompt}] + messages

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
                platforms = parsed.get("platforms", [a["platform"] for a in accounts])
                scheduled_at_str = parsed.get("scheduled_at")

                scheduled_at = None
                if scheduled_at_str:
                    try:
                        scheduled_at = datetime.fromisoformat(scheduled_at_str)
                        if scheduled_at.tzinfo is None:
                            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
                    except ValueError:
                        scheduled_at = None

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

                action = AgentAction(
                    type="create_post",
                    result={
                        "post_id": str(post.id),
                        "caption": caption[:80],
                        "platforms": platforms,
                        "scheduled_at": scheduled_at_str,
                        "status": post.status,
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

                    scheduled_at = None
                    if scheduled_at_str:
                        try:
                            scheduled_at = datetime.fromisoformat(scheduled_at_str)
                            if scheduled_at.tzinfo is None:
                                scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
                        except ValueError:
                            scheduled_at = None

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
        else:
            action = AgentAction(type="none")
            display_text = re.sub(r"```json[\s\S]*?```", "", raw_text).strip()

    return AgentChatResponse(
        message=AgentMessage(role="assistant", content=display_text or raw_text),
        model=data.model,
        action=action,
    )
