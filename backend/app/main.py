from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import engine, Base
from app.routers import auth, posts, accounts, ai_plan, scheduler, analytics, upload, admin

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create media dir, verify DB connection
    media_path = Path(settings.media_dir)
    media_path.mkdir(parents=True, exist_ok=True)

    async with engine.begin() as conn:
        # Tables created via Alembic in production; only auto-create in dev
        if not settings.is_production:
            await conn.run_sync(Base.metadata.create_all)

    yield

    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="ContentFlow API",
    description="Multi-platform content scheduler for bloggers",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(posts.router, prefix="/api/v1/posts", tags=["posts"])
app.include_router(accounts.router, prefix="/api/v1/accounts", tags=["accounts"])
app.include_router(ai_plan.router, prefix="/api/v1/ai", tags=["ai"])
app.include_router(scheduler.router, prefix="/api/v1/scheduler", tags=["scheduler"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(upload.router, prefix="/api/v1/upload", tags=["upload"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])

# Serve uploaded media
media_path = Path(settings.media_dir)
media_path.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_path)), name="media")


@app.get("/api/health", tags=["health"])
async def health_check():
    from datetime import datetime, timezone
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
