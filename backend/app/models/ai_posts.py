"""V6 — AI Post Creator models.

Tables: ai_post_drafts, image_jobs.

Circular FK:
  ai_post_drafts.image_job_id  →  image_jobs.id   SET NULL
  image_jobs.draft_id          →  ai_post_drafts.id  SET NULL

Both FKs declared with use_alter=True so SQLAlchemy/Alembic can emit
ALTER TABLE ... ADD CONSTRAINT after both tables exist.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, JSON, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# JSONB on PostgreSQL, plain JSON on SQLite (tests) — keeps the model portable.
JSONBType = JSONB().with_variant(JSON(), "sqlite")


class AiPostDraft(Base):
    """Draft post produced by the AI Post Creator."""
    __tablename__ = "ai_post_drafts"
    __table_args__ = (
        Index("ix_ai_post_drafts_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    # 'user_idea' | 'ai_recommendation'
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    topic_input: Mapped[str | None] = mapped_column(Text, nullable=True)
    caption: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    hashtags: Mapped[list] = mapped_column(JSONBType, nullable=False, default=list)
    # Circular FK to image_jobs — deferred via use_alter so both tables can be created first.
    image_job_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(
            "image_jobs.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_ai_post_drafts_image_job_id",
        ),
        nullable=True,
    )
    # 'generating' | 'ready' | 'sent_to_composer' | 'discarded'
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ready")
    generation_meta: Mapped[dict] = mapped_column(JSONBType, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships — no back_populates because of circular FK (use_alter)
    image_job: Mapped["ImageJob | None"] = relationship(
        "ImageJob",
        foreign_keys=[image_job_id],
        overlaps="draft",
    )


class ImageJob(Base):
    """Async image-generation job for an AI post draft."""
    __tablename__ = "image_jobs"
    __table_args__ = (
        Index("ix_image_jobs_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Circular FK — deferred via use_alter.
    draft_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(
            "ai_post_drafts.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_image_jobs_draft_id",
        ),
        nullable=True,
    )
    image_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    # 'queued' | 'generating' | 'done' | 'failed'
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships — no back_populates because of circular FK (use_alter)
    draft: Mapped["AiPostDraft | None"] = relationship(
        "AiPostDraft",
        foreign_keys=[draft_id],
        overlaps="image_job",
    )
