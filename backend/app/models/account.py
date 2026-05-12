import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint("user_id", "platform", "account_name", name="uq_user_platform_account"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)  # instagram | tiktok | telegram
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    credentials: Mapped[str] = mapped_column(Text, nullable=False)  # encrypted JSON
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="accounts")
    post_logs: Mapped[list["PostLog"]] = relationship(back_populates="account", cascade="all, delete-orphan")
    follower_snapshots: Mapped[list["FollowerSnapshot"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )
