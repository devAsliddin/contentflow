from contextlib import asynccontextmanager
from pathlib import Path
import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings
from app.database import engine, Base
from app.middleware.auth_middleware import try_decode_user_id
from app.routers import auth, posts, accounts, ai_plan, scheduler, analytics, upload, admin
from app.routers import oauth, ai_v2, analytics_v2, ai_v2_ext, workflows, ai_chat, ai_agent
from app.routers import instagram_connect, instagram_webhook, autoreply
from app.routers import analysis as analysis_v5
from app.routers import facebook_connect, facebook_webhook, ai_posts
from app.routers import news
from app.routers import data_privacy

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

logging.basicConfig(
    level=logging.INFO if settings.is_production else logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)
for noisy_logger in ("httpx", "httpcore"):
    logging.getLogger(noisy_logger).setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    media_path = Path(settings.media_dir)
    media_path.mkdir(parents=True, exist_ok=True)

    async with engine.begin() as conn:
        if not settings.is_production:
            await conn.run_sync(Base.metadata.create_all)

    logger.info(f"ContentFlow started — environment={settings.environment}")
    yield
    await engine.dispose()


# Docs only in non-production
_docs_url = None if settings.is_production else "/api/docs"
_redoc_url = None if settings.is_production else "/api/redoc"
_openapi_url = None if settings.is_production else "/api/openapi.json"

app = FastAPI(
    title="ContentFlow API",
    description="Multi-platform content scheduler for bloggers",
    version="1.0.0",
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    openapi_url=_openapi_url,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class RequestContextLoggingMiddleware(BaseHTTPMiddleware):
    """Tags each request with its authenticated user id (best-effort, from the
    JWT if present) and logs method/path/status/duration. This lets errors be
    correlated back to a specific user instead of only showing up as
    anonymous noise in the access log."""

    async def dispatch(self, request: Request, call_next):
        request.state.user_id = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            request.state.user_id = try_decode_user_id(auth_header[7:])

        start = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000, 1)

        user_tag = request.state.user_id or "anon"
        line = f"REQ user={user_tag} {request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)"
        if response.status_code >= 500:
            logger.error(line)
        elif response.status_code >= 400:
            logger.warning(line)
        else:
            logger.info(line)

        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "connect-src 'self'"
        )
        return response


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestContextLoggingMiddleware)

# CORS — origins from settings (comma-separated in env)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler — never leak tracebacks in production
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    user_tag = getattr(request.state, "user_id", None) or "anon"
    logger.exception(f"Unhandled error user={user_tag} on {request.method} {request.url}: {exc}")
    if settings.is_production:
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
    raise exc


# Routers
app.include_router(auth.router,      prefix="/api/v1/auth",      tags=["auth"])
app.include_router(posts.router,     prefix="/api/v1/posts",     tags=["posts"])
app.include_router(accounts.router,  prefix="/api/v1/accounts",  tags=["accounts"])
app.include_router(ai_plan.router,   prefix="/api/v1/ai",        tags=["ai"])
app.include_router(scheduler.router, prefix="/api/v1/scheduler", tags=["scheduler"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(upload.router,    prefix="/api/v1/upload",    tags=["upload"])
app.include_router(admin.router,     prefix="/api/v1/admin",     tags=["admin"])

# V2
app.include_router(oauth.router,         prefix="/api/v2/oauth",      tags=["oauth-v2"])
app.include_router(analytics.router,     prefix="/api/v2/analytics",  tags=["analytics-v2"])
app.include_router(analytics_v2.router,  prefix="/api/v2/analytics",  tags=["analytics-v2-ext"])
app.include_router(ai_v2.router,         prefix="/api/v2/ai",         tags=["ai-v2"])
app.include_router(ai_v2_ext.router,     prefix="/api/v2/ai",         tags=["ai-v2-ext"])
app.include_router(workflows.router,     prefix="/api/v2",            tags=["workflows-v2"])
app.include_router(ai_chat.router,       prefix="/api/v2/ai",         tags=["ai-chat"])
app.include_router(ai_agent.router,      prefix="/api/v2/ai",         tags=["ai-agent"])

# V4 — Instagram auto-reply (DM + comment). Paths match the Meta app config
# (OAuth redirect URI + webhook callback URL), so they are NOT under /api/v1|v2.
app.include_router(instagram_connect.router, prefix="/api/accounts/instagram", tags=["instagram-connect"])
app.include_router(instagram_webhook.router, prefix="/api/webhooks",           tags=["instagram-webhook"])
app.include_router(autoreply.router,         prefix="/api",                    tags=["autoreply-v4"])

# V5 — AI Analyst (frontend calls /api/v1/accounts/{id}/analysis/* via the v1 api client)
app.include_router(analysis_v5.router, prefix="/api/v1/accounts", tags=["analysis-v5"])

# V6 — Facebook OAuth + webhook + AI Post Creator
app.include_router(facebook_connect.router, prefix="/api/accounts/facebook", tags=["facebook-connect"])
app.include_router(facebook_webhook.router, prefix="/api/webhooks",           tags=["facebook-webhook"])
app.include_router(ai_posts.router,         prefix="/api/ai-posts",           tags=["ai-posts-v6"])

# V7 — Yangiliklar (news discovery → AI post)
app.include_router(news.router, prefix="/api/v1/news", tags=["news-v7"])

# Meta data-privacy callbacks (deauthorize + data-deletion) — required to go Live
app.include_router(data_privacy.router, prefix="/api/webhooks", tags=["meta-data-privacy"])

# V2-INFRA-002: analytics cache invalidation on post create is triggered inside workflows router

# Serve uploaded media (in production Nginx serves /media directly from disk)
media_path = Path(settings.media_dir)
media_path.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_path)), name="media")


@app.get("/api/health", tags=["health"])
async def health_check():
    from datetime import datetime, timezone
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
