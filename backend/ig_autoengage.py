"""Local Instagram auto-engagement bot (instagrapi + AI).

For accounts that use an instagrapi session (no Graph token) and run from a
residential IP. Polls on an interval and:

  1. Comments — replies to NEW comments on the account's recent media with an
     AI-generated reply (threaded).
  2. DMs — approves pending message requests, then replies (and keeps the
     conversation going) to everyone who messages, with AI.

Loop protection:
  - never replies to its own comments/messages
  - persists what it has already answered in .autoengage_state.json
  - on first run, seeds existing comments as "seen" (won't necro-reply old
    comments) but DOES answer DM threads currently awaiting a reply
  - per-cycle caps + human-like delays to reduce rate-limit/ban risk

Usage:  PYTHONPATH=. python ig_autoengage.py
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
import time
from pathlib import Path

from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.account import Account
from app.services.encryption import decrypt_credentials
from app.services.ollama_client import call_ollama_chat

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("autoengage")

ACC_ID = "1274cc91-5784-4e8f-90ff-1371284d7082"
STATE_FILE = Path(__file__).with_name(".autoengage_state.json")

# Tunables
CYCLE_SECONDS = 90
RECENT_MEDIA = 4          # how many recent posts to watch for comments
MAX_COMMENT_REPLIES = 8   # per cycle
MAX_DM_REPLIES = 15       # per cycle
MIN_DELAY, MAX_DELAY = 3, 7  # seconds between write actions

BRAND = "dev_asliddin"


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"seeded": False, "replied_comments": [], "thread_last": {}}


def save_state(state: dict) -> None:
    try:
        STATE_FILE.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    except Exception as e:  # noqa: BLE001
        log.warning("state save failed: %s", e)


def jitter() -> None:
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))


async def ai_comment_reply(comment_text: str, author: str) -> str:
    sys = (
        f"Siz {BRAND} Instagram sahifasining samimiy va do'stona SMM menejerisiz. "
        "Izohga juda qisqa (1 jumla), iliq va tabiiy o'zbekcha javob bering, 1 ta emoji bilan. "
        "Reklama qilmang, spam bo'lmang, foydalanuvchi ismini ishlatishingiz mumkin."
    )
    usr = f"@{author} izoh yozdi: \"{comment_text}\". Javob yozing."
    txt = await call_ollama_chat(
        [{"role": "system", "content": sys}, {"role": "user", "content": usr}],
        get_settings().openrouter_model, include_error_body=False,
    )
    return txt.strip().strip('"')[:280] or "Rahmat! 🙌"


async def ai_dm_reply(history: list[dict]) -> str:
    sys = (
        f"Siz {BRAND} brendining do'stona Instagram DM menejerisiz. "
        "Maqsad: foydalanuvchi bilan iliq, tabiiy suhbatni davom ettirish va uni maksimal "
        "darajada jalb qilish. Qisqa (1-2 jumla) o'zbekcha yozing, savol bering yoki "
        "suhbatni davom ettiradigan narsa qo'shing, 1 ta emoji bilan. Spam yoki reklama qilmang."
    )
    msgs = [{"role": "system", "content": sys}] + history[-6:]
    txt = await call_ollama_chat(
        msgs, get_settings().openrouter_model, include_error_body=False,
    )
    return txt.strip().strip('"')[:900] or "Salom! Qanday yordam bera olaman? 😊"


async def build_client():
    async with AsyncSessionLocal() as db:
        acc = (await db.execute(select(Account).where(Account.id == ACC_ID))).scalar_one()
        creds = decrypt_credentials(acc.credentials)
    from instagrapi import Client
    cl = Client()
    cl.set_settings(creds["ig_session"])
    cl.get_timeline_feed()  # refresh / validate
    return cl


def _comment_user(c) -> tuple[str, str]:
    user = getattr(c, "user", None)
    if user is not None:
        return str(getattr(user, "pk", "")), getattr(user, "username", "") or "user"
    return str(getattr(c, "user_id", "")), "user"


async def handle_comments(cl, me: str, state: dict) -> None:
    try:
        medias = cl.user_medias(me, amount=RECENT_MEDIA)
    except Exception as e:  # noqa: BLE001
        log.warning("user_medias failed: %s", e)
        return

    replied = set(state["replied_comments"])
    sent = 0
    for media in medias:
        mid = str(media.pk)
        try:
            comments = cl.media_comments(mid, amount=30)
        except Exception as e:  # noqa: BLE001
            log.warning("media_comments failed %s: %s", mid, e)
            continue
        for c in comments:
            cpk = str(c.pk)
            uid, uname = _comment_user(c)
            if cpk in replied or uid == me:
                continue
            if not state["seeded"]:
                # First run: mark existing comments as seen, don't necro-reply.
                replied.add(cpk)
                continue
            if sent >= MAX_COMMENT_REPLIES:
                break
            try:
                reply = await ai_comment_reply(c.text or "", uname)
                cl.media_comment(mid, reply, replied_to_comment_id=int(cpk))
                replied.add(cpk)
                sent += 1
                log.info("comment-> @%s: %s", uname, reply)
                jitter()
            except Exception as e:  # noqa: BLE001
                log.warning("reply to comment %s failed: %s", cpk, e)
                replied.add(cpk)  # avoid retry storm
    state["replied_comments"] = list(replied)[-2000:]


def _msg_text(m) -> str:
    return getattr(m, "text", None) or f"[{getattr(m, 'item_type', 'media')}]"


async def handle_dms(cl, me: str, state: dict) -> None:
    # 1) approve pending requests
    try:
        pending = cl.direct_pending_inbox(amount=20)
    except Exception as e:  # noqa: BLE001
        pending = []
        log.warning("pending inbox failed: %s", e)
    for th in pending:
        try:
            cl.direct_pending_approve(th.id)
            log.info("approved pending thread %s", th.id)
            jitter()
        except Exception as e:  # noqa: BLE001
            log.warning("approve failed %s: %s", th.id, e)

    # 2) reply across inbox threads
    try:
        threads = cl.direct_threads(amount=20)
    except Exception as e:  # noqa: BLE001
        log.warning("direct_threads failed: %s", e)
        return

    thread_last: dict = state["thread_last"]
    sent = 0
    for th in threads:
        if sent >= MAX_DM_REPLIES:
            break
        tid = str(th.id)
        try:
            msgs = list(reversed(cl.direct_messages(tid, amount=12)))  # oldest->newest
        except Exception as e:  # noqa: BLE001
            log.warning("direct_messages failed %s: %s", tid, e)
            continue
        if not msgs:
            continue
        last = msgs[-1]
        last_id = str(getattr(last, "id", ""))
        last_uid = str(getattr(last, "user_id", ""))
        # Only act if the newest message is from the other person and we haven't
        # already answered exactly this message.
        if last_uid == me:
            thread_last[tid] = last_id
            continue
        if thread_last.get(tid) == last_id:
            continue
        history = [
            {"role": "assistant" if str(getattr(m, "user_id", "")) == me else "user",
             "content": _msg_text(m)}
            for m in msgs
        ]
        try:
            reply = await ai_dm_reply(history)
            cl.direct_answer(tid, reply)
            thread_last[tid] = last_id
            sent += 1
            log.info("dm-> thread %s: %s", tid, reply)
            jitter()
        except Exception as e:  # noqa: BLE001
            log.warning("dm reply failed %s: %s", tid, e)
            thread_last[tid] = last_id
    state["thread_last"] = thread_last


async def main() -> None:
    log.info("autoengage starting for account %s", ACC_ID)
    cl = await build_client()
    me = str(cl.user_id)
    log.info("logged in as user_id=%s", me)
    state = load_state()

    while True:
        try:
            await handle_comments(cl, me, state)
            await handle_dms(cl, me, state)
            if not state["seeded"]:
                state["seeded"] = True
                log.info("first cycle seeded — now only NEW comments get replies")
            save_state(state)
        except Exception as e:  # noqa: BLE001
            log.exception("cycle error: %s", e)
        await asyncio.sleep(CYCLE_SECONDS)


if __name__ == "__main__":
    asyncio.run(main())
