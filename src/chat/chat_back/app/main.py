# app/main.py
import os
import logging
import uuid
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import redis.asyncio as aioredis

load_dotenv()
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
logging.basicConfig(level=LOG_LEVEL)
logger = logging.getLogger("chat.main")

from app.chat import router as chat_router, websocket_endpoint, start_redis_listener
from app.db import init_db, close_db

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


def create_app() -> FastAPI:
    app = FastAPI(title=os.getenv("APP_TITLE", "Chat Service"), version="0.1.0")

    cors_env = os.getenv("CORS_ORIGINS", "http://localhost:5176")
    allow_origins = [o.strip() for o in cors_env.split(",") if o.strip()]
    for u in ("http://127.0.0.1:5176","http://localhost:5176","http://127.0.0.1:5173","http://localhost:5173"):
        if u not in allow_origins:
            allow_origins.append(u)


    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    upload_dir = os.getenv("UPLOAD_DIR", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")
    app.state.upload_dir = upload_dir


    app.include_router(chat_router, prefix="/api/chat")
    from app.routers import user_blocking
    app.include_router(user_blocking.router, prefix="/api/users", tags=["blocking"])
    app.websocket("/ws/chat/{conversation_id}")(websocket_endpoint)

    @app.on_event("startup")
    async def on_startup():
        logger.info("Starting Chat Service...")
        await init_db()

        try:
            app.state.redis = aioredis.from_url(REDIS_URL, decode_responses=True)
            try:
                await app.state.redis.ping()
                logger.info("Connected to Redis at %s", REDIS_URL)
            except Exception:
                logger.warning("Redis reachable but PING failed (continuing without blocking).")
        except Exception as e:
            app.state.redis = None
            logger.warning("Failed to create Redis client (%s). Continuing without Redis.", e)

        app.state.instance_id = str(uuid.uuid4())

        if app.state.redis:
            from asyncio import create_task
            create_task(start_redis_listener(app))
        else:
            logger.info("Redis listener not started because Redis client is None.")

        logger.info("Startup complete.")

    @app.on_event("shutdown")
    async def on_shutdown():
        logger.info("Shutting down Chat Service...")
        try:
            if getattr(app.state, "redis", None):
                await app.state.redis.close()
        except Exception:
            logger.exception("Error closing Redis client (ignored)")

        await close_db()
        logger.info("Shutdown complete.")

    return app


app = create_app()
