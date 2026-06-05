"""add ai_credits to users

Revision ID: 004
Revises: 003
Create Date: 2026-06-05

"""
from alembic import op
import sqlalchemy as sa

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('ai_credits', sa.Integer(), nullable=False, server_default='2000'))
    op.add_column('users', sa.Column('ai_credits_limit', sa.Integer(), nullable=False, server_default='2000'))


def downgrade() -> None:
    op.drop_column('users', 'ai_credits_limit')
    op.drop_column('users', 'ai_credits')
