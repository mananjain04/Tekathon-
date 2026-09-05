from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.routes import auth, documents, rag, retrieval
# Import user_models so SQLAlchemy/Alembic sees the User table
import app.db.user_models  # noqa: F401


app = FastAPI(
    title="SIH AI Backend",
    description="Offline AI and RAG backend",
    version="0.1.0",
)

# Allow the future React frontend (dev server) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(retrieval.router)
app.include_router(rag.router)


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "message": "SIH backend is running",
    }


@app.get("/api/health/db")
def health_check_db(db: Session = Depends(get_db)):
    """
    Verifies the PostgreSQL connection and confirms the pgvector
    extension is installed and reachable.
    """
    db.execute(text("SELECT 1"))
    vector_ext = db.execute(
        text("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
    ).first()

    return {
        "status": "ok",
        "database": "connected",
        "pgvector_installed": vector_ext is not None,
        "pgvector_version": vector_ext[0] if vector_ext else None,
    }
