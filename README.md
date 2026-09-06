# KAVACH Sovereign Document AI Workbench

[![Docker Compose](https://img.shields.io/badge/Docker%20Compose-Ready-blue?logo=docker)](docker-compose.yml)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](backend/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB?logo=react)](frontend/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20pgvector-336791?logo=postgresql)](backend/)
[![Air-Gapped](https://img.shields.io/badge/Security-Air--Gap%20Sovereign-green?logo=shield)](backend/docs/)

**KAVACH** is a zero-trust, sovereign, on-premise Retrieval-Augmented Generation (RAG) platform designed for mission-critical industrial, defense, and public-sector operations (Refineries, PSUs, Strategic Infrastructure).

Under strict national data sovereignty and air-gap compliance mandates, **zero data ever leaves the local enclave or contacts public cloud LLMs**.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   React 18 Frontend                    │
│      (Vite + Tailwind CSS + Sovereign Enclave UI)      │
│                     Port: 3000                         │
└───────────────────────────┬────────────────────────────┘
                            │ Reverse Proxy /api
┌───────────────────────────▼────────────────────────────┐
│                    FastAPI Backend                     │
│         (JWT Auth, RBAC, PyMuPDF Ingestion,            │
│         SentenceTransformers 384d, Cross-Encoder)      │
│                     Port: 8000                         │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
              ▼                            ▼
┌───────────────────────────┐┌───────────────────────────┐
│  PostgreSQL 16 + pgvector ││   Ollama Local LLM        │
│    (HNSW Cosine Index)    ││   (Qwen 2.5 / Llama 3)    │
│        Port: 5432         ││        Port: 11434        │
└───────────────────────────┘└───────────────────────────┘
```

---

## 🚀 Quickstart with Docker Compose

Run the complete four-service stack with a single command:

```bash
docker compose up --build
```

### Services Started:
| Service | Technology | Port | Purpose |
|---|---|---|---|
| **`frontend`** | Nginx + React 18 SPA | `http://localhost:3000` | Sovereign AI inquiry UI, document explorer, telemetry |
| **`backend`** | FastAPI + Python 3.11 | `http://localhost:8000` | REST API, PDF processing, dense embeddings, RAG |
| **`db`** | PostgreSQL 16 + pgvector | `localhost:5432` | Vector storage with HNSW index & user schemas |
| **`ollama`** | Ollama Container | `localhost:11434` | Local sovereign LLM runtime |

### 🔑 Default Credentials (Auto-Seeded)

The database automatically migrates schema and seeds these initial role-based access accounts upon startup:

* **Admin:** `admin` / `Kavach@2026!` (Full administrative clearance)
* **Analyst:** `analyst` / `Kavach@2026!` (Document ingestion & query clearance)
* **Viewer:** `viewer` / `Kavach@2026!` (Read-only query clearance)

---

## ⚡ NVIDIA GPU Acceleration (Optional Host Mode)

If your host machine has an NVIDIA RTX GPU (e.g. RTX 4050 6GB) and you run Ollama locally on Windows for maximum speed:

1. Keep Ollama running on your Windows machine (`ollama serve`).
2. Pull your model: `ollama pull qwen2.5:latest`.
3. In `.env` or `docker-compose.yml`, point the backend to the host gateway:
   ```env
   OLLAMA_BASE_URL=http://host.docker.internal:11434
   ```
4. Run:
   ```bash
   docker compose up --build
   ```
The backend automatically connects to host Ollama through Docker's secure host gateway without touching external networks.

---

## 💻 Manual Local Development (Without Docker)

### 1. Database
Ensure PostgreSQL 16+ with `pgvector` is running locally on port 5432:
```bash
# Database: sih_rag
cd backend
alembic upgrade head
python scripts/init_db.py
```

### 2. Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Swagger API documentation will be live at `http://localhost:8000/docs`.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
The React frontend will be live at `http://localhost:3000`.

---

## 🧪 Testing & Verification

Run the comprehensive unit and integration test suite:

```bash
cd backend
pytest -q
```
All tests run in 100% offline mode with zero network access required.
