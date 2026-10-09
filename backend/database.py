from __future__ import annotations

import logging
from typing import AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

import config

logger = logging.getLogger(__name__)

_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_engine() -> Optional[AsyncEngine]:
    global _engine, _session_factory

    if _engine is not None:
        return _engine

    if not config.DATABASE_URL:
        logger.warning(
            "[database] FWPATHFINDER_DATABASE_URL is not set — "
            "running in stateless mode (no persistence)"
        )
        return None

    if not config.DATABASE_URL.startswith("postgresql+asyncpg://"):
        logger.error(
            "[database] DATABASE_URL must use the postgresql+asyncpg:// scheme. "
            "Got: %s", config.DATABASE_URL[:40]
        )
        return None

    _engine = create_async_engine(config.DATABASE_URL, pool_pre_ping=True)
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    logger.info("[database] Async engine initialised.")
    return _engine


async def get_db() -> AsyncGenerator[Optional[AsyncSession], None]:
    engine = get_engine()
    if engine is None or _session_factory is None:
        yield None
        return

    async with _session_factory() as session:
        yield session
