# scripts/create_test_user.py
import asyncio
from app.db import AsyncSessionLocal, init_db
from app.models import User
from app.utils.jwt import create_access_token
from sqlalchemy import insert, select

async def create_user(username: str = "2"):
    await init_db()
    async with AsyncSessionLocal() as session:
        # creer us
        q = select(User).filter(User.username == username)
        r = await session.execute(q)
        user = r.scalars().first()
        if not user:
            stmt = insert(User).values(username=username)
            await session.execute(stmt)
            await session.commit()
            r = await session.execute(select(User).filter(User.username == username))
            user = r.scalars().first()
        print("User id:", user.id)
        token = create_access_token({"sub": str(user.id)})
        print("JWT (use this in front):", token)

if __name__ == "__main__":
    asyncio.run(create_user())
