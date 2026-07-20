"""Redis client for ContentFlow — used for OAuth state and caching."""
import redis.asyncio as aioredis
from app.config import get_settings

settings = get_settings()

redis_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global redis_client
    if redis_client is None:
        redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            # Fail fast when Redis is unreachable instead of blocking each
            # request ~4s on the connect. Callers already treat cache/state
            # access as best-effort (try/except), so a quick failure just
            # degrades gracefully.
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    return redis_client
