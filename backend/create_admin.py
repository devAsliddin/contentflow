"""
Create or promote a user to admin.

Usage:
    python create_admin.py --email admin@example.com --password yourpassword
    python create_admin.py --email existing@user.com --promote
"""
import asyncio
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.models.user import User
from app.middleware.auth_middleware import hash_password


async def main(email: str, password: str | None, promote: bool) -> None:
    db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:contentflow123@localhost:5432/contentflow")
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if promote:
            if not user:
                print(f"[error] User {email} not found. Register first.")
                return
            user.is_admin = True
            session.add(user)
            await session.commit()
            print(f"[ok] {email} promoted to admin.")
            return

        if user:
            if not password:
                print(f"[error] User {email} already exists. Use --promote to make admin.")
                return
            user.hashed_password = hash_password(password)
            user.is_admin = True
            user.is_active = True
            session.add(user)
            await session.commit()
            print(f"[ok] {email} password reset and set as admin.")
        else:
            if not password:
                print("[error] --password required when creating a new user.")
                return
            new_user = User(
                email=email,
                hashed_password=hash_password(password),
                full_name="Admin",
                is_active=True,
                is_admin=True,
            )
            session.add(new_user)
            await session.commit()
            print(f"[ok] Admin user {email} created.")

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create or promote admin user")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", default=None)
    parser.add_argument("--promote", action="store_true", help="Promote existing user to admin")
    args = parser.parse_args()
    asyncio.run(main(args.email, args.password, args.promote))
