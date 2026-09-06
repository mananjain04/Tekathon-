"""
backend/scripts/init_db.py — Automated database bootstrap and seed script.

Executed on container startup:
1. Pings PostgreSQL until reachable.
2. Ensures `pgvector` extension is active.
3. Applies Alembic migrations (`upgrade head`).
4. Seeds default accounts (admin, analyst, viewer) if no users exist.
"""
import os
import sys
import time
from pathlib import Path

# Ensure backend root is on sys.path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from app.core.config import settings
from app.db.database import engine, SessionLocal
from app.db.user_models import User, UserRole
from app.services.auth_service import create_user


def wait_for_db(max_retries=30, delay_sec=2):
    print("[init_db] Waiting for PostgreSQL to become available...")
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                print(f"[init_db] PostgreSQL is ready (attempt {attempt}/{max_retries}).")
                return True
        except Exception as exc:
            print(f"[init_db] Waiting for database (attempt {attempt}/{max_retries}): {exc}")
            time.sleep(delay_sec)
    print("[init_db] ERROR: Timed out waiting for PostgreSQL.")
    sys.exit(1)


def ensure_pgvector_extension():
    print("[init_db] Ensuring 'vector' extension is installed...")
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
    print("[init_db] 'vector' extension verified.")


def run_migrations():
    print("[init_db] Running Alembic database migrations...")
    alembic_ini_path = backend_root / "alembic.ini"
    alembic_cfg = Config(str(alembic_ini_path))
    alembic_cfg.set_main_option("script_location", str(backend_root / "migrations"))
    command.upgrade(alembic_cfg, "head")
    print("[init_db] Alembic migrations completed successfully.")



def seed_default_users():
    print("[init_db] Checking user accounts...")
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        if user_count == 0:
            print("[init_db] No users found in database. Seeding default accounts...")
            create_user(
                db,
                username="admin",
                plain_password="Kavach@2026!",
                role=UserRole.ADMIN,
            )
            create_user(
                db,
                username="analyst",
                plain_password="Kavach@2026!",
                role=UserRole.ANALYST,
            )
            create_user(
                db,
                username="viewer",
                plain_password="Kavach@2026!",
                role=UserRole.VIEWER,
            )
            print("[init_db] Default accounts created successfully:")
            print("  - Admin:   username='admin'   / password='Kavach@2026!'")
            print("  - Analyst: username='analyst' / password='Kavach@2026!'")
            print("  - Viewer:  username='viewer'  / password='Kavach@2026!'")
        else:
            print(f"[init_db] Found {user_count} existing user(s). Skipping seed.")
    finally:
        db.close()


def main():
    wait_for_db()
    ensure_pgvector_extension()
    run_migrations()
    seed_default_users()
    print("[init_db] Database initialization finished successfully.")


if __name__ == "__main__":
    main()
