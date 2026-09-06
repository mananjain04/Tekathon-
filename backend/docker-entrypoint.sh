#!/bin/sh
set -e

echo "[KAVACH Entrypoint] Starting KAVACH Sovereign Document AI Backend..."

# Initialize database, pgvector extension, migrations, and default users
python scripts/init_db.py

echo "[KAVACH Entrypoint] Initialization complete. Launching application..."
exec "$@"
