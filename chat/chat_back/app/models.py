# app/models.py
from sqlalchemy.orm import declarative_base
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    Text,
    DateTime,
    Index,
    UniqueConstraint,
)
from datetime import datetime
from sqlalchemy.sql import func

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(256), nullable=True)
    is_active = Column(Boolean, default=True)
    avatar = Column(String(500), nullable=True)


class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=True)
    is_group = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"))


class Participant(Base):
    __tablename__ = "participants"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    is_admin = Column(Boolean, default=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (
        Index("ix_part_conv_user", "conversation_id", "user_id", unique=True),
    )


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=True)
    attachment_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    edited = Column(Boolean(), nullable=False, server_default="false")
    deleted = Column(Boolean(), nullable=False, server_default="false")


class MessageRead(Base):
    __tablename__ = "message_reads"
    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    read_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("message_id", "user_id", name="unique_message_user_read"),)


class MessageReaction(Base):
    __tablename__ = "message_reactions"
    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    emoji = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("message_id", "user_id", "emoji", name="unique_message_user_emoji"),)


class UserBlock(Base):
    __tablename__ = "user_blocks"
    id = Column(Integer, primary_key=True)
    blocker_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="unique_blocker_blocked"),)


class TeamConversationLink(Base):
    __tablename__ = "team_conversation_links"
    id = Column(Integer, primary_key=True)
    team_id = Column(Integer, nullable=False)
    project_slug = Column(String(255), nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, unique=True)
    __table_args__ = (
        UniqueConstraint("team_id", "project_slug", name="uix_team_project_slug"),
    )
