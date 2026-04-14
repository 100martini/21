from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, insert, delete, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_async_session
from app.models import User, UserBlock
from app.chat import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/block/{user_id}")
async def block_user(
    user_id: int, 
    current_user = Depends(get_current_user), 
    db: AsyncSession = Depends(get_async_session)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    
    res = await db.execute(select(User).filter(User.id == user_id))
    if not res.scalars().first():
        raise HTTPException(status_code=404, detail="User not found")
        
    q = select(UserBlock).filter(
        UserBlock.blocker_id == current_user.id,
        UserBlock.blocked_id == user_id
    )
    if (await db.execute(q)).scalars().first():
        return {"message": "User already blocked"}

    block = UserBlock(blocker_id=current_user.id, blocked_id=user_id)
    db.add(block)
    await db.commit()
    logger.info(f"User {current_user.id} blocked {user_id}")
    return {"message": "User blocked"}

@router.delete("/block/{user_id}")
async def unblock_user(
    user_id: int, 
    current_user = Depends(get_current_user), 
    db: AsyncSession = Depends(get_async_session)
):
    stmt = delete(UserBlock).where(
        UserBlock.blocker_id == current_user.id,
        UserBlock.blocked_id == user_id
    )
    result = await db.execute(stmt)
    await db.commit()
    
    if result.rowcount == 0:
         raise HTTPException(status_code=404, detail="Block not found")
         
    return {"message": "User unblocked"}

@router.get("/blocked")
async def get_blocked_users(
    current_user = Depends(get_current_user), 
    db: AsyncSession = Depends(get_async_session)
):
    q = select(User).join(UserBlock, User.id == UserBlock.blocked_id).filter(
        UserBlock.blocker_id == current_user.id
    )
    res = await db.execute(q)
    users = res.scalars().all()
    return [{"id": u.id, "username": u.username} for u in users]
