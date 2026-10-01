"""
MarketOS — SQLAlchemy Database Configuration
Configures both synchronous and asynchronous engines for PostgreSQL.

IMPORTANT: All imports of optional/heavy modules are done INSIDE try/except blocks
so that a missing dependency (e.g. greenlet) does NOT crash uvicorn at import time
and kill Railway's healthcheck before the server can bind its port.
"""
import os
import logging
from typing import AsyncGenerator, Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://marketos:marketos_dev@localhost:5433/marketos")
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# ── Synchronous engine (psycopg2) ─────────────────────────────────────────────
try:
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception as _db_err:
    logging.warning(f"[DB] Failed to create sync engine (non-fatal): {_db_err}")
    engine = None  # type: ignore
    SessionLocal = None  # type: ignore

# ── Asynchronous engine (asyncpg + greenlet) ──────────────────────────────────
# greenlet must be installed: pip install sqlalchemy[asyncio] greenlet
# The import is intentionally INSIDE the try block — if greenlet is missing,
# the top-level `from sqlalchemy.ext.asyncio import ...` would crash uvicorn
# before it can bind its port (killing Railway's healthcheck).
try:
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

    async_engine = create_async_engine(
        ASYNC_DATABASE_URL,
        pool_size=20,
        max_overflow=40,
        pool_pre_ping=True
    )
    AsyncSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=async_engine)
except ImportError as _greenlet_err:
    logging.warning(
        f"[DB] SQLAlchemy asyncio unavailable — greenlet not installed (non-fatal): {_greenlet_err}. "
        "Install with: pip install sqlalchemy[asyncio] greenlet"
    )
    async_engine = None       # type: ignore
    AsyncSessionLocal = None  # type: ignore
    AsyncSession = None       # type: ignore
except Exception as _async_db_err:
    logging.warning(f"[DB] Failed to create async engine (non-fatal): {_async_db_err}")
    async_engine = None       # type: ignore
    AsyncSessionLocal = None  # type: ignore
    AsyncSession = None       # type: ignore


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    if SessionLocal is None:
        raise RuntimeError("Database not configured — DATABASE_URL is missing or invalid.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_db() -> AsyncGenerator:
    if AsyncSessionLocal is None:
        raise RuntimeError("Async database not configured — greenlet/asyncpg not installed or DATABASE_URL invalid.")
    async with AsyncSessionLocal() as session:
        yield session
