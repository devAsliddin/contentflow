"""add follower snapshots

Revision ID: 003
Revises: 002
Create Date: 2026-05-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'follower_snapshots',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('platform', sa.String(50), nullable=False),
        sa.Column('follower_count', sa.Integer(), nullable=False),
        sa.Column('following_count', sa.Integer(), nullable=True),
        sa.Column('media_count', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(50), nullable=False, server_default='manual'),
        sa.Column('captured_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_follower_snapshots_account_id', 'follower_snapshots', ['account_id'])
    op.create_index('ix_follower_snapshots_captured_at', 'follower_snapshots', ['captured_at'])
    op.create_index('ix_follower_snapshots_platform', 'follower_snapshots', ['platform'])
    op.create_index('ix_follower_snapshots_user_captured', 'follower_snapshots', ['user_id', 'captured_at'])


def downgrade() -> None:
    op.drop_index('ix_follower_snapshots_user_captured', table_name='follower_snapshots')
    op.drop_index('ix_follower_snapshots_platform', table_name='follower_snapshots')
    op.drop_index('ix_follower_snapshots_captured_at', table_name='follower_snapshots')
    op.drop_index('ix_follower_snapshots_account_id', table_name='follower_snapshots')
    op.drop_table('follower_snapshots')
