1# app/crud.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Conversation, Participant, Message
from datetime import datetime
from sqlalchemy import insert, select, update, delete, and_
from app.models import Message, MessageRead, MessageReaction

async def create_conversation(db: AsyncSession, creator_id: int, participant_ids: list[int], name: str | None = None) -> int:
    """
    Heuristique :
    - Groupe si :
      * un nom est fourni (canal de projet), OU
      * il y a plus de 2 participants (3 personnes et +)
    - Sinon (exactement 2 participants, sans nom explicite) => DM simple.
    """
    conv = Conversation(
        name=name,
        is_group=bool(name) or len(participant_ids) > 2,
        created_by=creator_id,
    )
    db.add(conv)
    await db.flush()
    conv_id = conv.id
    uids = set(participant_ids + [creator_id])
    for uid in uids:
        db.add(Participant(conversation_id=conv_id, user_id=uid, is_admin=(uid == creator_id)))
    await db.commit()
    return conv_id

async def persist_message(db: AsyncSession, conv_id: int, user_id: int, content: str | None, attachment_url: str | None):
    msg = Message(conversation_id=conv_id, user_id=user_id, content=content, attachment_url=attachment_url)
    db.add(msg)
    await db.flush()
    await db.commit()
    await db.refresh(msg)
    return msg.id, msg.created_at

async def get_messages_for_conv(db: AsyncSession, conv_id: int, limit: int = 50):
    q = select(Message).filter(Message.conversation_id == conv_id).order_by(Message.created_at.desc()).limit(limit)
    res = await db.execute(q)
    return res.scalars().all()


async def mark_message_read(db: AsyncSession, message_id: int, user_id: int):
    stmt = insert(MessageRead).values(message_id=message_id, user_id=user_id).on_conflict_do_nothing()
    await db.execute(stmt)
    await db.commit()
    return

async def get_message_reads(db: AsyncSession, message_id: int):
    q = select(MessageRead).filter(MessageRead.message_id == message_id)
    r = await db.execute(q)
    return r.scalars().all()

async def edit_message(db: AsyncSession, message_id:int, user_id:int, new_content:str):
    stmt = update(Message).where(Message.id==message_id).values(content=new_content, edited=True, edited_at=datetime.utcnow())
    await db.execute(stmt)
    await db.commit()
    q = select(Message).filter(Message.id==message_id)
    r = await db.execute(q)
    return r.scalars().first()

async def update_message(session: AsyncSession, message_id: int, user_id: int, new_content: str):
    q = select(Message).filter(Message.id == message_id)
    r = await session.execute(q)
    m = r.scalars().first()
    if not m:
        return None
    if m.user_id != user_id:
        raise PermissionError("not author")
    m.content = new_content
    m.edited = True
    m.created_at = m.created_at
    await session.commit()
    await session.refresh(m)
    return m

async def delete_message(session: AsyncSession, message_id: int, user_id: int):
    q = select(Message).filter(Message.id == message_id)
    r = await session.execute(q)
    m = r.scalars().first()
    if not m:
        return None
    if m.user_id != user_id:
        raise PermissionError("not author")
    m.deleted = True
    m.content = None
    await session.commit()
    await session.refresh(m)
    return m

async def mark_message_read(session: AsyncSession, message_id: int, user_id: int):
    q = select(MessageRead).filter(MessageRead.message_id == message_id, MessageRead.user_id == user_id)
    r = await session.execute(q)
    if r.scalars().first():
        return None
    mr = MessageRead(message_id=message_id, user_id=user_id)
    session.add(mr)
    await session.commit()
    await session.refresh(mr)
    return mr

async def add_reaction(session: AsyncSession, message_id: int, user_id: int, emoji: str):
    q = select(MessageReaction).filter(
        MessageReaction.message_id == message_id,
        MessageReaction.user_id == user_id,
        MessageReaction.emoji == emoji
    )
    r = await session.execute(q)
    if r.scalars().first():
        return None
    
    reaction = MessageReaction(message_id=message_id, user_id=user_id, emoji=emoji)
    session.add(reaction)
    try:
        await session.commit()
        await session.refresh(reaction)
        return reaction
    except Exception:
        await session.rollback()
        return None

async def remove_reaction(session: AsyncSession, message_id: int, user_id: int, emoji: str):
    stmt = delete(MessageReaction).where(
        and_(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == user_id,
            MessageReaction.emoji == emoji
        )
    )
    await session.execute(stmt)
    await session.commit()
    return True