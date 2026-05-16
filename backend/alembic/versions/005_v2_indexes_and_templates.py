"""V2: PostgreSQL indexes + templates model

Revision ID: 005
Revises: 004
Create Date: 2026-05-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── V2-INFRA-001: composite indexes for common query patterns ──────────────
    op.create_index(
        'ix_posts_user_status',
        'posts', ['user_id', 'status'],
        unique=False,
    )
    op.create_index(
        'ix_posts_user_scheduled_at',
        'posts', ['user_id', 'scheduled_at'],
        unique=False,
    )
    op.create_index(
        'ix_posts_status_scheduled_at',
        'posts', ['status', 'scheduled_at'],
        unique=False,
    )
    op.create_index(
        'ix_post_logs_platform',
        'post_logs', ['platform'],
        unique=False,
    )
    op.create_index(
        'ix_post_logs_post_platform',
        'post_logs', ['post_id', 'platform'],
        unique=False,
    )

    # ── V2-WF-005: PostTemplate model ─────────────────────────────────────────
    op.create_table(
        'post_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('caption', sa.Text, nullable=True),
        sa.Column('platforms', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('platform_options', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('hashtags', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('media_type', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_post_templates_user_id', 'post_templates', ['user_id'])

    # ── V2-ACC-003: oauth_migrated flag on accounts ────────────────────────────
    op.add_column(
        'accounts',
        sa.Column('oauth_migrated', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'accounts',
        sa.Column('oauth_migrated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ── V2-WF-002: pending_review status already fits in String(20) ───────────
    # No schema change needed; the status column already allows arbitrary strings up to 20 chars.


def downgrade() -> None:
    op.drop_column('accounts', 'oauth_migrated_at')
    op.drop_column('accounts', 'oauth_migrated')
    op.drop_index('ix_post_templates_user_id', 'post_templates')
    op.drop_table('post_templates')
    op.drop_index('ix_post_logs_post_platform', 'post_logs')
    op.drop_index('ix_post_logs_platform', 'post_logs')
    op.drop_index('ix_posts_status_scheduled_at', 'posts')
    op.drop_index('ix_posts_user_scheduled_at', 'posts')
    op.drop_index('ix_posts_user_status', 'posts')
