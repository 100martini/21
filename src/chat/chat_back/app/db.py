# app/db.py
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models import Base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/chatdb")

engine = create_async_engine(DATABASE_URL, future=True, echo=False)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Apply incremental schema changes that create_all won't handle on existing tables
        try:
            await conn.execute(
                __import__('sqlalchemy').text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(500)"
                )
            )
        except Exception:
            pass

async def close_db():
    await engine.dispose()

async def get_async_session():
    async with AsyncSessionLocal() as session:
        yield session

