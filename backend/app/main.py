from contextlib import asynccontextmanager
from pathlib import Path
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import engine, Base
from app.routers import auth, posts, accounts, ai_plan, scheduler, analytics, upload, admin
from app.routers import oauth, ai_v2, analytics_v2, ai_v2_ext, workflows, ai_chat, ai_agent

settings = get_settings()
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
    logger.exception(f"Unhandled error on {request.method} {request.url}: {exc}")
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

# V2-INFRA-002: analytics cache invalidation on post create is triggered inside workflows router

# Serve uploaded media (in production Nginx serves /media directly from disk)
media_path = Path(settings.media_dir)
media_path.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_path)), name="media")


@app.get("/api/health", tags=["health"])
async def health_check():
    from datetime import datetime, timezone
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
