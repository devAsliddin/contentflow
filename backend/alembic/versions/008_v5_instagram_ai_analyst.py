"""V5: Instagram AI Analyst — media, metrics, classifications, snapshots, profiles,
recommendations, analysis jobs.

Revision ID: 008
Revises: 007
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── PostgreSQL native ENUMs ─────────────────────────────────────────────────

    media_type_enum = postgresql.ENUM(
        'IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', 'REELS',
        name='media_type_enum',
        create_type=True,
    )
    media_type_enum.create(op.get_bind(), checkfirst=True)

    profile_status_enum = postgresql.ENUM(
        'generating', 'ready', 'failed',
        name='profile_status_enum',
        create_type=True,
    )
    profile_status_enum.create(op.get_bind(), checkfirst=True)

    analysis_job_type_enum = postgresql.ENUM(
        'initial_analysis', 'weekly_refresh',
        name='analysis_job_type_enum',
        create_type=True,
    )
    analysis_job_type_enum.create(op.get_bind(), checkfirst=True)

    analysis_job_status_enum = postgresql.ENUM(
        'queued', 'fetching', 'computing', 'classifying', 'profiling', 'done', 'failed',
        name='analysis_job_status_enum',
        create_type=True,
    )
    analysis_job_status_enum.create(op.get_bind(), checkfirst=True)

    # ── media_items ─────────────────────────────────────────────────────────────
    op.create_table(
        'media_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('ig_media_id', sa.String(255), nullable=False),
        sa.Column('media_type', postgresql.ENUM(
            'IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', 'REELS',
            name='media_type_enum', create_type=False,
        ), nullable=False),
        sa.Column('caption', sa.Text(), nullable=True),
        sa.Column('hashtags', postgresql.JSONB(astext_type=sa.Text()), nullable=False,
                  server_default=sa.text("'[]'::jsonb")),
        sa.Column('permalink', sa.Text(), nullable=True),
        sa.Column('posted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ig_media_id', name='uq_media_items_ig_media_id'),
    )
    op.create_index(
        'ix_media_items_account_posted_at',
        'media_items', ['account_id', 'posted_at'],
    )

    # ── media_metrics ───────────────────────────────────────────────────────────
    op.create_table(
        'media_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('media_item_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('like_count', sa.Integer(), nullable=True),
        sa.Column('comments_count', sa.Integer(), nullable=True),
        sa.Column('saved_count', sa.Integer(), nullable=True),
        sa.Column('shares_count', sa.Integer(), nullable=True),
        sa.Column('reach', sa.Integer(), nullable=True),
        sa.Column('impressions', sa.Integer(), nullable=True),
        sa.Column('plays', sa.Integer(), nullable=True),
        sa.Column('avg_watch_time_ms', sa.Integer(), nullable=True),
        sa.Column('engagement_rate', sa.Numeric(6, 4), nullable=True),
        sa.Column('fetched_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['media_item_id'], ['media_items.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_media_metrics_item_fetched_at',
        'media_metrics', ['media_item_id', 'fetched_at'],
    )

    # ── media_classifications ───────────────────────────────────────────────────
    op.create_table(
        'media_classifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('media_item_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('topic', sa.String(100), nullable=True),
        sa.Column('tone', sa.String(50), nullable=True),
        sa.Column('has_cta', sa.Boolean(), nullable=True),
        sa.Column('language', sa.String(10), nullable=True),
        sa.Column('model_used', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['media_item_id'], ['media_items.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('media_item_id', name='uq_media_classifications_media_item_id'),
    )

    # ── account_metrics_snapshots ───────────────────────────────────────────────
    op.create_table(
        'account_metrics_snapshots',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('snapshot_date', sa.Date(), nullable=False),
        sa.Column('followers_count', sa.Integer(), nullable=False),
        sa.Column('following_count', sa.Integer(), nullable=False),
        sa.Column('media_count', sa.Integer(), nullable=False),
        sa.Column('reach_28d', sa.Integer(), nullable=True),
        sa.Column('impressions_28d', sa.Integer(), nullable=True),
        sa.Column('profile_views_28d', sa.Integer(), nullable=True),
        sa.Column('demographics', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('raw', postgresql.JSONB(astext_type=sa.Text()), nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('account_id', 'snapshot_date',
                            name='uq_account_metrics_account_date'),
    )

    # ── account_profiles ────────────────────────────────────────────────────────
    op.create_table(
        'account_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('profile_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column('model_used', sa.String(100), nullable=True),
        sa.Column('status', postgresql.ENUM(
            'generating', 'ready', 'failed',
            name='profile_status_enum', create_type=False,
        ), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_account_profiles_account_id', 'account_profiles', ['account_id'])

    # ── ai_recommendations ──────────────────────────────────────────────────────
    op.create_table(
        'ai_recommendations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('week_start', sa.Date(), nullable=False),
        sa.Column('recommendations_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column('model_used', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('account_id', 'week_start',
                            name='uq_ai_recommendations_account_week'),
    )

    # ── analysis_jobs ───────────────────────────────────────────────────────────
    op.create_table(
        'analysis_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('job_type', postgresql.ENUM(
            'initial_analysis', 'weekly_refresh',
            name='analysis_job_type_enum', create_type=False,
        ), nullable=False),
        sa.Column('status', postgresql.ENUM(
            'queued', 'fetching', 'computing', 'classifying', 'profiling', 'done', 'failed',
            name='analysis_job_status_enum', create_type=False,
        ), nullable=False, server_default='queued'),
        sa.Column('progress_pct', sa.SmallInteger(), nullable=False, server_default='0'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    # ── drop tables (reverse order of creation) ─────────────────────────────────
    op.drop_table('analysis_jobs')
    op.drop_table('ai_recommendations')
    op.drop_index('ix_account_profiles_account_id', 'account_profiles')
    op.drop_table('account_profiles')
    op.drop_table('account_metrics_snapshots')
    op.drop_table('media_classifications')
    op.drop_index('ix_media_metrics_item_fetched_at', 'media_metrics')
    op.drop_table('media_metrics')
    op.drop_index('ix_media_items_account_posted_at', 'media_items')
    op.drop_table('media_items')

    # ── drop native ENUM types ────────────────────────────────────────────────
    op.execute('DROP TYPE IF EXISTS analysis_job_status_enum')
    op.execute('DROP TYPE IF EXISTS analysis_job_type_enum')
    op.execute('DROP TYPE IF EXISTS profile_status_enum')
    op.execute('DROP TYPE IF EXISTS media_type_enum')
