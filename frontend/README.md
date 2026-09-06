# KAVACH Sovereign Document AI - Frontend (Phase 1)

KAVACH is a sovereign, on-premise, document-based AI/RAG workbench designed for confidential industrial and government environments.

## Architecture & Decisions Implemented
- **Framework**: React 18 + TypeScript + Vite + Tailwind CSS.
- **Independence**: Fully decoupled from backend Python environment and dependencies.
- **Chat Protocol (Decision #2)**: Standard synchronous JSON HTTP responses via `/api/chat`. No SSE streaming is implemented at this phase.
- **Security Posture**: Tailored UI for defense/government operations (classification badges, air-gap indicators, cryptographic hashes, WORM logging indicators).

## Pages Implemented
1. **`/login`** - Defense-grade authorization portal with clearance classification and token input.
2. **`/dashboard`** - Sovereign enclave telemetry, hardware node health, storage partitions, recent classified documents, and quick launch triggers.
3. **`/documents`** - Classified document repository, search/clearance filtering, and document ingestion modal.
4. **`/documents/:id`** - Forensic document view displaying vector chunks, token counts, SHA-256 hashes, and ingestion parameters.
5. **`/chat`** - Sovereign AI inquiry assistant with synchronous JSON querying and cryptographic source citations.
6. **`/settings`** - Sovereign hardware node configuration, local embedding/LLM selector, vector DB parameters, and air-gap policies.

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
The application will launch on `http://localhost:3000`.

### 3. Run Typecheck & Production Build
```bash
npm run typecheck
npm run build
```

## Transferring to Target Repository Location
To deploy or synchronize this frontend into `D:\SIH\Tekathon-\frontend`:
```powershell
Copy-Item -Recurse -Force "C:\Users\HP\.gemini\antigravity\scratch\frontend\*" "D:\SIH\Tekathon-\frontend\"
```
