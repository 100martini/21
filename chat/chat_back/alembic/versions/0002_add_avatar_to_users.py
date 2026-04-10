"""add avatar to users

Revision ID: 0002_add_avatar_to_users
Revises: 0001_initial
Create Date: 2026-03-16 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0002_add_avatar_to_users'
down_revision = '0001_initial'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('users', sa.Column('avatar', sa.String(500), nullable=True))

def downgrade():
    op.drop_column('users', 'avatar')
