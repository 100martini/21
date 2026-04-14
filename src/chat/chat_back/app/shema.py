# app/schemas.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class MessageCreate(BaseModel):
    content: str
    attachment_url: Optional[str] = None
    client_temp_id: Optional[str] = None

class MessageRead(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_username: Optional[str] = None
    content: Optional[str] = None
    attachment_url: Optional[str] = None
    created_at: Optional[datetime] = None
    edited: bool = False
    deleted: bool = False
    # opt
    reads: Optional[List[dict]] = None

    class Config:
        orm_mode = True

class ConversationCreate(BaseModel):
    name: Optional[str] = None
    participant_ids: List[int]

class ConversationRead(BaseModel):
    id: int
    name: Optional[str] = None
    is_group: bool = False

    class Config:
        orm_mode = True
