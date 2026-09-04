import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import create_engine, pool

# Make "app" importable when alembic is run from backend/
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.db.database import Base  # noqa: E402
from app.db import models  # noqa: E402,F401  (registers models on Base.metadata)

config = context.config

# IMPORTANT: do NOT pass the DB URL through config.set_main_option() /
# alembic.ini's ConfigParser. ConfigParser applies %-style interpolation
# to option values, and a percent-encoded password (e.g. "%40" for "@")
# is not valid interpolation syntax -- it raises ValueError before Alembic
# even attempts a connection. So the URL is kept out of the ConfigParser
# entirely and passed straight to SQLAlchemy below instead.

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    # Pass the URL string directly to SQLAlchemy -- never round-tripped
    # through config.set_main_option()/ConfigParser (see note above).
    context.configure(
        url=settings.sqlalchemy_database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Build the engine directly from the URL object (not the ini-file
    # string) so credentials with special characters are never at risk
    # of being mis-parsed by a second round of string parsing.
    connectable = create_engine(settings.sqlalchemy_url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
