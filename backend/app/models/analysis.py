"""V5 — Instagram AI Analyst models.

Tables: media_items, media_metrics, media_classifications,
        account_metrics_snapshots, account_profiles,
        ai_recommendations, analysis_jobs.
"""
import uuid
from datetime import datetime, timezone, date

from sqlalchemy import (
    String, Boolean, Integer, SmallInteger, DateTime, Date,
    ForeignKey, Text, Index, UniqueConstraint, Numeric,
    Enum as SAEnum,
)
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# JSONB on PostgreSQL, plain JSON on SQLite (tests) — keeps the model portable.
JSONBType = JSONB().with_variant(JSON(), "sqlite")

# ---------------------------------------------------------------------------
# PostgreSQL native ENUMs
# ---------------------------------------------------------------------------

media_type_enum = SAEnum(
    "IMAGE", "VIDEO", "CAROUSEL_ALBUM", "REELS",
    name="media_type_enum",
    create_type=True,
)

profile_status_enum = SAEnum(
    "generating", "ready", "failed",
    name="profile_status_enum",
    create_type=True,
)

analysis_job_type_enum = SAEnum(
    "initial_analysis", "weekly_refresh",
    name="analysis_job_type_enum",
    create_type=True,
)

analysis_job_status_enum = SAEnum(
    "queued", "fetching", "computing", "classifying", "profiling", "done", "failed",
    name="analysis_job_status_enum",
    create_type=True,
)


# ---------------------------------------------------------------------------
# 2.1 media_items — Instagram post cache
# ---------------------------------------------------------------------------

class MediaItem(Base):
    """Cached Instagram media objects for a connected account."""
    __tablename__ = "media_items"
    __table_args__ = (
        Index("ix_media_items_account_posted_at", "account_id", "posted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    ig_media_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    media_type: Mapped[str] = mapped_column(media_type_enum, nullable=False)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    hashtags: Mapped[dict] = mapped_column(JSONBType, nullable=False, default=list
    )
    permalink: Mapped[str | None] = mapped_column(Text, nullable=True)
    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# 2.2 media_metrics — per-post statistics snapshot
# ---------------------------------------------------------------------------

class MediaMetric(Base):
    """Snapshot of engagement metrics for one media item."""
    __tablename__ = "media_metrics"
    __table_args__ = (
        Index("ix_media_metrics_item_fetched_at", "media_item_id", "fetched_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    media_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("media_items.id", ondelete="CASCADE"), nullable=False
    )
    like_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comments_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    saved_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    shares_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reach: Mapped[int | None] = mapped_column(Integer, nullable=True)
    impressions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    plays: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_watch_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    engagement_rate: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


# ---------------------------------------------------------------------------
# 2.3 media_classifications — AI classification result (1 per post)
# ---------------------------------------------------------------------------

class MediaClassification(Base):
    """AI-generated classification for one media item caption."""
    __tablename__ = "media_classifications"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    media_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("media_items.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    topic: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    has_cta: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


# ---------------------------------------------------------------------------
# 2.4 account_metrics_snapshots — daily account-level snapshot
# ---------------------------------------------------------------------------

class AccountMetricsSnapshot(Base):
    """Daily snapshot of account-level Instagram metrics."""
    __tablename__ = "account_metrics_snapshots"
    __table_args__ = (
        UniqueConstraint("account_id", "snapshot_date", name="uq_account_metrics_account_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    followers_count: Mapped[int] = mapped_column(Integer, nullable=False)
    following_count: Mapped[int] = mapped_column(Integer, nullable=False)
    media_count: Mapped[int] = mapped_column(Integer, nullable=False)
    reach_28d: Mapped[int | None] = mapped_column(Integer, nullable=True)
    impressions_28d: Mapped[int | None] = mapped_column(Integer, nullable=True)
    profile_views_28d: Mapped[int | None] = mapped_column(Integer, nullable=True)
    demographics: Mapped[dict | None] = mapped_column(JSONBType, nullable=True)
    raw: Mapped[dict] = mapped_column(JSONBType, nullable=False, default=dict)


# ---------------------------------------------------------------------------
# 2.5 account_profiles — AI-generated "Account DNA"
# ---------------------------------------------------------------------------

class AccountProfile(Base):
    """Versioned AI-generated profile (niche, tone, content pillars, etc.)."""
    __tablename__ = "account_profiles"
    __table_args__ = (
        Index("ix_account_profiles_account_id", "account_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    profile_json: Mapped[dict] = mapped_column(JSONBType, nullable=False, default=dict)
    model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(profile_status_enum, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


# ---------------------------------------------------------------------------
# 2.6 ai_recommendations — weekly AI recommendations
# ---------------------------------------------------------------------------

class AIRecommendation(Base):
    """Weekly AI-generated recommendations for an account."""
    __tablename__ = "ai_recommendations"
    __table_args__ = (
        UniqueConstraint("account_id", "week_start", name="uq_ai_recommendations_account_week"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    recommendations_json: Mapped[dict] = mapped_column(JSONBType, nullable=False, default=dict
    )
    model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


# ---------------------------------------------------------------------------
# 2.7 analysis_jobs — analysis process state (for frontend polling)
# ---------------------------------------------------------------------------

class AnalysisJob(Base):
    """Tracks the state of each analysis pipeline run for a given account."""
    __tablename__ = "analysis_jobs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    job_type: Mapped[str] = mapped_column(analysis_job_type_enum, nullable=False)
    status: Mapped[str] = mapped_column(
        analysis_job_status_enum, nullable=False, server_default="queued"
    )
    progress_pct: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
