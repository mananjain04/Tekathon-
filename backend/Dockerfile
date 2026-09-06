# ==============================================================================
# KAVACH Sovereign Document AI - Backend Dockerfile
# Base: Python 3.11 slim + Tesseract OCR engine + PyMuPDF + SentenceTransformers
# ==============================================================================

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install OS-level dependencies:
# - tesseract-ocr & libtesseract-dev: local OCR fallback for scanned PDF pages
# - build-essential & cmake: C/C++ compiler for native extensions
# - curl: container healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    curl \
    tesseract-ocr \
    libtesseract-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Ensure storage directory exists and entrypoint script is executable
RUN mkdir -p storage && chmod +x docker-entrypoint.sh

# Expose FastAPI port
EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
