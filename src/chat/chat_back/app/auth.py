# app/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert
from passlib.context import CryptContext
from datetime import timedelta
from app.db import get_async_session, User
from app.utils.jwt import create_access_token

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register")
async def register(payload: dict, db: AsyncSession = Depends(get_async_session)):
    username = payload.get("username")
    password = payload.get("password")
    if not username or not password:
        raise HTTPException(status_code=400, detail="username & password required")
    q = select(User).filter(User.username == username)
    r = await db.execute(q)
    if r.scalars().first():
        raise HTTPException(status_code=400, detail="username already exists")
    hashed = pwd_ctx.hash(password)
    stmt = insert(User).values(username=username, hashed_password=hashed).returning(User.id)
    res = await db.execute(stmt)
    await db.commit()
    uid = res.scalar_one()
    token = create_access_token({"sub": str(uid)})
    return {"user_id": uid, "access_token": token}

@router.post("/login")
async def login(payload: dict, db: AsyncSession = Depends(get_async_session)):
    username = payload.get("username")
    password = payload.get("password")
    if not username or not password:
        raise HTTPException(status_code=400, detail="username & password required")
    q = select(User).filter(User.username == username)
    r = await db.execute(q)
    user = r.scalars().first()
    if not user or not user.hashed_password or not pwd_ctx.verify(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return {"user_id": user.id, "access_token": token}
