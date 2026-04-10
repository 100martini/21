# alembic/env.py
import asyncio
from logging.config import fileConfig
import os
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncEngine

from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.models import Base
target_metadata = Base.metadata

DATABASE_URL = os.environ.get("DATABASE_URL")

def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = DATABASE_URL or config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection):
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations():
    """Run migrations in 'online' mode using AsyncEngine."""
    url = DATABASE_URL or config.get_main_option("sqlalchemy.url")
    connectable = create_engine(url.replace('+asyncpg', ''), poolclass=pool.NullPool)
    with connectable.connect() as connection:
        do_run_migrations(connection)

def run_migrations_online():
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
