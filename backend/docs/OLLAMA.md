# KAVACH — Ollama LLM Provider Setup Guide

This document explains how to set up, configure, and verify the local
Ollama-based LLM provider for the KAVACH offline RAG system.

## Why Ollama?

KAVACH requires 100% local, air-gapped LLM inference. The original `llama-cpp-python`
provider cannot currently be installed on Windows (Python 3.13 + no prebuilt wheel +
Windows Long Path issue). Ollama provides the same offline capability with:

- A single cross-platform installer (Windows, Linux, macOS)
- No C++ toolchain or CMake required
- A simple HTTP API that KAVACH calls on localhost only
- The same GGUF/GGML model ecosystem

**Security guarantee:** After `ollama pull <model>`, KAVACH works with no Internet
access. The application communicates only with `http://localhost:11434` (or whatever
`OLLAMA_BASE_URL` is set to) — never with OpenAI, Anthropic, Groq, or any cloud API.

---

## 1. Install Ollama

### Windows
1. Download the installer from https://ollama.com/download/windows
2. Run the `.exe` installer — it installs Ollama and registers it as a background service.

### Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### macOS
Download from https://ollama.com/download/mac or via Homebrew:
```bash
brew install ollama
```

---

## 2. Start the Ollama server

If not already started automatically:

```bash
ollama serve
```

Verify it is running:
```bash
curl http://localhost:11434/
# Should return: Ollama is running
```

---

## 3. Pull the configured model (requires Internet once only)

Check which model KAVACH is configured to use:

```bash
# In backend/.env (or the default in .env.example):
# OLLAMA_MODEL=qwen2.5:7b
```

Pull that model:
```bash
ollama pull qwen2.5:7b
```

Other tested options:
```bash
ollama pull llama3.1:8b    # Meta Llama 3.1 8B
ollama pull mistral:7b     # Mistral 7B
ollama pull gemma2:9b      # Google Gemma 2 9B
```

After pulling, the model is stored locally. No further Internet access is needed
for inference.

---

## 4. Configure KAVACH

Copy the example .env and set the Ollama variables:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_TIMEOUT=120.0
```

`OLLAMA_TIMEOUT` controls the per-request deadline in seconds. Increase it on
slower hardware where the model may take longer to load into memory on the first
request.

---

## 5. Run the RAG query pipeline

Start the backend:
```powershell
cd backend
uvicorn app.main:app --reload --port 8000
```

Upload and process a PDF:
```powershell
# Upload
curl -X POST http://localhost:8000/api/documents/upload -F "file=@your_document.pdf"
# Returns: {"id": "<doc-uuid>", "status": "UPLOADED", ...}

# Process (extract, chunk, embed)
curl -X POST http://localhost:8000/api/documents/<doc-uuid>/process
```

Run a RAG query:
```powershell
curl -X POST http://localhost:8000/api/rag/query `
  -H "Content-Type: application/json" `
  -d '{"query": "What is the operating pressure of Pump P-204?", "top_k": 10}'
```

Expected response:
```json
{
  "query": "What is the operating pressure of Pump P-204?",
  "answer": "The operating pressure of Pump P-204 is 38.5 bar (page 42).",
  "sources": [
    {
      "chunk_id": "...",
      "document_id": "...",
      "page_number": 42,
      "chunk_index": 3,
      "text": "P-204 operating limits: max pressure 38.5 bar ...",
      "similarity": 0.91,
      "rerank_score": 8.4
    }
  ]
}
```

---

## 6. Verify offline operation (air-gap test)

Once the model is pulled, you can verify KAVACH is fully air-gapped:

1. Disconnect from the network (disable Wi-Fi / Ethernet).
2. Confirm Ollama server is still running: `curl http://localhost:11434/`
3. Run a RAG query — it should succeed with no Internet connection.
4. Check logs: no external HTTP calls should appear.

To confirm at the code level, search for any external HTTP clients:
```powershell
# Must return ZERO results for any cloud LLM endpoint
grep -r "openai.com\|anthropic.com\|groq.com\|api.together\|googleapis.com" backend/app/
```

---

## 7. Run the test suite

Normal (offline, no real Ollama server needed):
```powershell
cd backend
..\venv\Scripts\python.exe -m pytest -v
```

Ollama integration test (requires Ollama running + model pulled):
```powershell
..\venv\Scripts\python.exe -m pytest -m real_ollama_model -v
```

---

## 8. Switching models

To change the model, update `.env`:
```env
OLLAMA_MODEL=llama3.1:8b
```

Pull it first if not already pulled:
```bash
ollama pull llama3.1:8b
```

Then restart the backend. The new model takes effect immediately.

---

## 9. Future multi-model routing

The configuration is designed for single-model use now but is extensible.
Future variables (not yet implemented):

```env
OLLAMA_GENERAL_MODEL=qwen2.5:7b
OLLAMA_REASONING_MODEL=deepseek-r1:7b
OLLAMA_CODING_MODEL=qwen2.5-coder:7b
```

When multi-model routing is added, the OllamaProvider class can be extended
without changing the RAG orchestration layer (`rag_service.py`) or the routes.

---

## 10. Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Cannot connect to the local Ollama server` | Ollama not running | Run `ollama serve` |
| `Ollama model 'X' was not found` | Model not pulled | Run `ollama pull X` |
| `Ollama request timed out after Ns` | Slow hardware, model loading | Increase `OLLAMA_TIMEOUT` in `.env` |
| `Unknown LLM_PROVIDER 'X'` | Typo in `.env` | Use `ollama` or `llama_cpp` only |
| `HTTP 500` from Ollama | Model error | Check `ollama serve` logs |

---

## 11. Security reminders

- **NEVER** set `OLLAMA_BASE_URL` to a remote/cloud URL.
- **NEVER** set `LLM_PROVIDER` to `groq`, `openai`, or any cloud value — the factory will reject it.
- Do **not** commit `.env` to Git — it is git-ignored.
- GGUF model files are git-ignored (`*.gguf`) — they must never be committed.
