# alembic/versions/0001_initial.py
"""initial

Revision ID: 0001_initial
Revises: 
Create Date: 2026-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.Integer, primary_key=True, nullable=False),
        sa.Column('username', sa.String(150), nullable=False, unique=True, index=True),
        sa.Column('hashed_password', sa.String(256), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.true()),
    )

    op.create_table(
        'conversations',
        sa.Column('id', sa.Integer, primary_key=True, nullable=False),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('is_group', sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
    )

    op.create_table(
        'participants',
        sa.Column('id', sa.Integer, primary_key=True, nullable=False),
        sa.Column('conversation_id', sa.Integer, sa.ForeignKey('conversations.id'), nullable=True, index=True),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True, index=True),
        sa.Column('is_admin', sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column('joined_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_part_conv_user', 'participants', ['conversation_id', 'user_id'], unique=True)

    op.create_table(
        'messages',
        sa.Column('id', sa.Integer, primary_key=True, nullable=False),
        sa.Column('conversation_id', sa.Integer, sa.ForeignKey('conversations.id'), nullable=False, index=True),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('attachment_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_messages_conv_created', 'messages', ['conversation_id', 'created_at'])
    

def downgrade():
    op.drop_index('ix_messages_conv_created', table_name='messages')
    op.drop_table('messages')
    op.drop_index('ix_part_conv_user', table_name='participants')
    op.drop_table('participants')
    op.drop_table('conversations')
    op.drop_table('users')
