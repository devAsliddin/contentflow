"""
Database reset script — drops all tables and recreates them via SQLAlchemy.
Runs against the DATABASE_URL in .env (or environment variable).

Usage:
  python reset_db.py                  # full reset (drop + create)
  python reset_db.py --truncate-only  # truncate all rows, keep schema
  python reset_db.py --confirm        # skip confirmation prompt

WARNING: This DELETES ALL DATA. Do not run in production.
"""
import asyncio
import sys

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Import all models so metadata is populated
from app.config import get_settings
from app.database import Base
import app.models.user          # noqa: F401
import app.models.account       # noqa: F401
import app.models.post          # noqa: F401
import app.models.post_template # noqa: F401


settings = get_settings()

TRUNCATE_ONLY = "--truncate-only" in sys.argv
SKIP_CONFIRM  = "--confirm" in sys.argv


async def reset(truncate_only: bool = False):
    if settings.is_production:
        print("ERROR: reset_db.py refuses to run in production environment.")
        sys.exit(1)

    if not SKIP_CONFIRM:
        mode = "TRUNCATE ALL ROWS" if truncate_only else "DROP AND RECREATE ALL TABLES"
        answer = input(f"\n⚠️  This will {mode} in:\n  {settings.database_url}\n\nType 'yes' to confirm: ")
        if answer.strip().lower() != "yes":
            print("Aborted.")
            return

    engine = create_async_engine(settings.database_url, echo=True)

    async with engine.begin() as conn:
        if truncate_only:
            # Disable FK checks, truncate all known tables, re-enable
            table_names = list(Base.metadata.tables.keys())
            await conn.execute(text("SET session_replication_role = 'replica'"))
            for tbl in table_names:
                await conn.execute(text(f'TRUNCATE TABLE "{tbl}" CASCADE'))
            await conn.execute(text("SET session_replication_role = 'origin'"))
            print(f"\n✅ Truncated {len(table_names)} tables: {table_names}")
        else:
            # Full drop + recreate
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
            print("\n✅ All tables dropped and recreated.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(reset(truncate_only=TRUNCATE_ONLY))
