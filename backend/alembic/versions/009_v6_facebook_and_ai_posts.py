"""V6: Facebook integration columns + AI Post Creator tables (ai_post_drafts, image_jobs).

Revision ID: 009
Revises: 008
Create Date: 2026-06-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect as sa_inspect

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa_inspect(bind)
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols


def _table_exists(table: str) -> bool:
    bind = op.get_bind()
    insp = sa_inspect(bind)
    return table in insp.get_table_names()


def _fk_exists(table: str, name: str) -> bool:
    bind = op.get_bind()
    insp = sa_inspect(bind)
    return any(fk["name"] == name for fk in insp.get_foreign_keys(table))


def _index_exists(table: str, name: str) -> bool:
    bind = op.get_bind()
    insp = sa_inspect(bind)
    return any(ix["name"] == name for ix in insp.get_indexes(table))


def upgrade() -> None:
    # ── 1. accounts: new Facebook + token_status columns ──────────────────────
    if not _column_exists('accounts', 'fb_user_id'):
        op.add_column('accounts', sa.Column('fb_user_id', sa.String(255), nullable=True))
    if not _column_exists('accounts', 'fb_page_id'):
        op.add_column('accounts', sa.Column('fb_page_id', sa.String(255), nullable=True))
    if not _column_exists('accounts', 'fb_page_name'):
        op.add_column('accounts', sa.Column('fb_page_name', sa.String(255), nullable=True))
    if not _column_exists('accounts', 'fb_webhook_subscribed'):
        op.add_column('accounts', sa.Column(
            'fb_webhook_subscribed', sa.Boolean(), nullable=False,
            server_default='false',
        ))
    if not _column_exists('accounts', 'token_status'):
        op.add_column('accounts', sa.Column(
            'token_status', sa.String(16), nullable=False,
            server_default='active',
        ))

    # ── 2. autoreply_rules: platform + reply_mode + ai_context ────────────────
    if not _column_exists('autoreply_rules', 'platform'):
        op.add_column('autoreply_rules', sa.Column(
            'platform', sa.String(16), nullable=False, server_default='instagram',
        ))
    if not _column_exists('autoreply_rules', 'reply_mode'):
        op.add_column('autoreply_rules', sa.Column(
            'reply_mode', sa.String(16), nullable=False, server_default='template',
        ))
    if not _column_exists('autoreply_rules', 'ai_context'):
        op.add_column('autoreply_rules', sa.Column('ai_context', sa.Text(), nullable=True))

    # ── 3. autoreply_logs: platform + reply_mode ───────────────────────────────
    if not _column_exists('autoreply_logs', 'platform'):
        op.add_column('autoreply_logs', sa.Column(
            'platform', sa.String(16), nullable=False, server_default='instagram',
        ))
    if not _column_exists('autoreply_logs', 'reply_mode'):
        op.add_column('autoreply_logs', sa.Column('reply_mode', sa.String(16), nullable=True))

    # ── 4. ai_post_drafts — create WITHOUT the circular FK first ──────────────
    if not _table_exists('ai_post_drafts'):
        op.create_table(
            'ai_post_drafts',
            sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('source', sa.String(20), nullable=False),
            sa.Column('topic_input', sa.Text(), nullable=True),
            sa.Column('caption', sa.Text(), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('hashtags', postgresql.JSONB(astext_type=sa.Text()), nullable=False,
                      server_default=sa.text("'[]'::jsonb")),
            # image_job_id column added here as plain nullable UUID;
            # the FK constraint is added later via op.create_foreign_key (circular).
            sa.Column('image_job_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('status', sa.String(20), nullable=False, server_default='ready'),
            sa.Column('generation_meta', postgresql.JSONB(astext_type=sa.Text()), nullable=False,
                      server_default=sa.text("'{}'::jsonb")),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
        )

    if not _index_exists('ai_post_drafts', 'ix_ai_post_drafts_user_id'):
        op.create_index('ix_ai_post_drafts_user_id', 'ai_post_drafts', ['user_id'])

    # ── 5. image_jobs — create WITHOUT the circular FK first ──────────────────
    if not _table_exists('image_jobs'):
        op.create_table(
            'image_jobs',
            sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
            # draft_id column as plain nullable UUID; FK added later.
            sa.Column('draft_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('image_prompt', sa.Text(), nullable=False),
            sa.Column('provider', sa.String(50), nullable=False),
            sa.Column('model', sa.String(100), nullable=False),
            sa.Column('status', sa.String(16), nullable=False, server_default='queued'),
            sa.Column('file_path', sa.Text(), nullable=True),
            sa.Column('width', sa.Integer(), nullable=False),
            sa.Column('height', sa.Integer(), nullable=False),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )

    if not _index_exists('image_jobs', 'ix_image_jobs_user_id'):
        op.create_index('ix_image_jobs_user_id', 'image_jobs', ['user_id'])

    # ── 6. Circular FKs — both tables now exist, safe to add constraints ───────
    if not _fk_exists('ai_post_drafts', 'fk_ai_post_drafts_image_job_id'):
        op.create_foreign_key(
            'fk_ai_post_drafts_image_job_id',
            'ai_post_drafts', 'image_jobs',
            ['image_job_id'], ['id'],
            ondelete='SET NULL',
        )
    if not _fk_exists('image_jobs', 'fk_image_jobs_draft_id'):
        op.create_foreign_key(
            'fk_image_jobs_draft_id',
            'image_jobs', 'ai_post_drafts',
            ['draft_id'], ['id'],
            ondelete='SET NULL',
        )


def downgrade() -> None:
    # ── Drop circular FKs first (must precede table drops) ────────────────────
    if _fk_exists('image_jobs', 'fk_image_jobs_draft_id'):
        op.drop_constraint('fk_image_jobs_draft_id', 'image_jobs', type_='foreignkey')
    if _fk_exists('ai_post_drafts', 'fk_ai_post_drafts_image_job_id'):
        op.drop_constraint('fk_ai_post_drafts_image_job_id', 'ai_post_drafts', type_='foreignkey')

    # ── Drop new tables ────────────────────────────────────────────────────────
    if _index_exists('image_jobs', 'ix_image_jobs_user_id'):
        op.drop_index('ix_image_jobs_user_id', table_name='image_jobs')
    if _table_exists('image_jobs'):
        op.drop_table('image_jobs')
    if _index_exists('ai_post_drafts', 'ix_ai_post_drafts_user_id'):
        op.drop_index('ix_ai_post_drafts_user_id', table_name='ai_post_drafts')
    if _table_exists('ai_post_drafts'):
        op.drop_table('ai_post_drafts')

    # ── Drop autoreply_logs columns ────────────────────────────────────────────
    if _column_exists('autoreply_logs', 'reply_mode'):
        op.drop_column('autoreply_logs', 'reply_mode')
    if _column_exists('autoreply_logs', 'platform'):
        op.drop_column('autoreply_logs', 'platform')

    # ── Drop autoreply_rules columns ───────────────────────────────────────────
    if _column_exists('autoreply_rules', 'ai_context'):
        op.drop_column('autoreply_rules', 'ai_context')
    if _column_exists('autoreply_rules', 'reply_mode'):
        op.drop_column('autoreply_rules', 'reply_mode')
    if _column_exists('autoreply_rules', 'platform'):
        op.drop_column('autoreply_rules', 'platform')

    # ── Drop accounts columns ──────────────────────────────────────────────────
    if _column_exists('accounts', 'token_status'):
        op.drop_column('accounts', 'token_status')
    if _column_exists('accounts', 'fb_webhook_subscribed'):
        op.drop_column('accounts', 'fb_webhook_subscribed')
    if _column_exists('accounts', 'fb_page_name'):
        op.drop_column('accounts', 'fb_page_name')
    if _column_exists('accounts', 'fb_page_id'):
        op.drop_column('accounts', 'fb_page_id')
    if _column_exists('accounts', 'fb_user_id'):
        op.drop_column('accounts', 'fb_user_id')
