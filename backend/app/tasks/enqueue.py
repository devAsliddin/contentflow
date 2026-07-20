"""Detached, best-effort Celery enqueue helper.

apply_async() / .delay() / control.revoke() are blocking broker I/O. Calling
them inline in an async request handler freezes the event loop for ~20s when the
broker is unreachable (e.g. Redis down in local dev). These helpers run the call
on a detached background task so the request returns immediately; any persisted
work is recovered by beat tasks (e.g. `recover_missed_posts`).
"""
import asyncio
import logging

logger = logging.getLogger(__name__)

# Keep strong refs so detached tasks aren't garbage-collected mid-flight.
_bg_tasks: set = set()


def fire_and_forget(thunk, *, label: str = "celery enqueue") -> None:
    """Run a blocking Celery call (a zero-arg callable) detached from the request.

    `thunk` should perform the (lazy import +) `.delay()`/`apply_async()` call.
    Any exception — including a broker connection stall — is swallowed with a
    warning, since the caller treats enqueue as best-effort.
    """
    async def _run() -> None:
        try:
            await asyncio.to_thread(thunk)
        except Exception:
            logger.warning("Detached %s failed (broker slow/down)", label)

    task = asyncio.create_task(_run())
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)
