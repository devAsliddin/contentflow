"""V4: Instagram auto-reply rules + logs, account IG webhook fields

Revision ID: 007
Revises: 006
Create Date: 2026-06-08

Enum-like columns use VARCHAR + CHECK constraints rather than native PG ENUM
types. The ORM models map them as String, and CHECK gives the same value-safety
without the migration pain of ALTER TYPE ... ADD VALUE on native enums.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── accounts: Instagram professional id + webhook subscription state ────────
    op.add_column('accounts', sa.Column('ig_user_id', sa.String(255), nullable=True))
    op.add_column(
        'accounts',
        sa.Column('ig_webhook_subscribed', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.create_index('ix_accounts_ig_user_id', 'accounts', ['ig_user_id'])

    # ── autoreply_rules ─────────────────────────────────────────────────────────
    op.create_table(
        'autoreply_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('target', sa.String(16), nullable=False),
        sa.Column('match_type', sa.String(16), nullable=False),
        sa.Column('keywords', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('case_sensitive', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('reply_text', sa.Text(), nullable=False),
        sa.Column('comment_action', sa.String(16), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("target IN ('dm','comment')", name='ck_autoreply_rules_target'),
        sa.CheckConstraint(
            "match_type IN ('contains','exact','starts_with','any')",
            name='ck_autoreply_rules_match_type',
        ),
        sa.CheckConstraint(
            "comment_action IS NULL OR comment_action IN ('reply_public','reply_private','both')",
            name='ck_autoreply_rules_comment_action',
        ),
    )
    op.create_index(
        'ix_autoreply_rules_account_target_active',
        'autoreply_rules', ['account_id', 'target', 'is_active'],
    )
    op.create_index('ix_autoreply_rules_user_id', 'autoreply_rules', ['user_id'])

    # ── autoreply_logs ──────────────────────────────────────────────────────────
    op.create_table(
        'autoreply_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('rule_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('event_type', sa.String(16), nullable=False),
        sa.Column('ig_object_id', sa.String(255), nullable=False),
        sa.Column('sender_ig_id', sa.String(255), nullable=True),
        sa.Column('incoming_text', sa.Text(), nullable=True),
        sa.Column('matched_keyword', sa.String(255), nullable=True),
        sa.Column('reply_text', sa.Text(), nullable=True),
        sa.Column('status', sa.String(32), nullable=False),
        sa.Column('error_detail', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['rule_id'], ['autoreply_rules.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('account_id', 'ig_object_id', name='uq_autoreply_account_object'),
        sa.CheckConstraint("event_type IN ('dm','comment')", name='ck_autoreply_logs_event_type'),
        sa.CheckConstraint(
            "status IN ('sent','skipped_no_match','skipped_rate_limit',"
            "'skipped_24h','skipped_self','failed')",
            name='ck_autoreply_logs_status',
        ),
    )
    op.create_index(
        'ix_autoreply_logs_account_created',
        'autoreply_logs', ['account_id', 'created_at'],
    )
    op.create_index('ix_autoreply_logs_status', 'autoreply_logs', ['status'])


def downgrade() -> None:
    op.drop_index('ix_autoreply_logs_status', 'autoreply_logs')
    op.drop_index('ix_autoreply_logs_account_created', 'autoreply_logs')
    op.drop_table('autoreply_logs')

    op.drop_index('ix_autoreply_rules_user_id', 'autoreply_rules')
    op.drop_index('ix_autoreply_rules_account_target_active', 'autoreply_rules')
    op.drop_table('autoreply_rules')

    op.drop_index('ix_accounts_ig_user_id', 'accounts')
    op.drop_column('accounts', 'ig_webhook_subscribed')
    op.drop_column('accounts', 'ig_user_id')
