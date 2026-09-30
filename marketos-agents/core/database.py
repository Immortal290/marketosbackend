"""
MarketOS — SQLAlchemy Database Configuration
Configures both synchronous and asynchronous engines for PostgreSQL.
"""
import os
from typing import AsyncGenerator, Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://marketos:marketos_dev@localhost:5433/marketos")
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Wrap engine creation in try/except — a bad DATABASE_URL or missing driver
# must NOT crash the process at import time, which would prevent uvicorn from
# binding its port and fail Railway's healthcheck.
try:
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception as _db_err:
    import logging
    logging.warning(f"[DB] Failed to create sync engine (non-fatal): {_db_err}")
    engine = None  # type: ignore
    SessionLocal = None  # type: ignore

try:
    async_engine = create_async_engine(
        ASYNC_DATABASE_URL,
        pool_size=20,
        max_overflow=40,
        pool_pre_ping=True
    )
    AsyncSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=async_engine)
except Exception as _async_db_err:
    import logging
    logging.warning(f"[DB] Failed to create async engine (non-fatal): {_async_db_err}")
    async_engine = None  # type: ignore
    AsyncSessionLocal = None  # type: ignore

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

async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    if AsyncSessionLocal is None:
        raise RuntimeError("Async database not configured — DATABASE_URL is missing or invalid.")
    async with AsyncSessionLocal() as session:
        yield session

