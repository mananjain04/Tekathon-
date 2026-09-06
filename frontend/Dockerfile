# ==============================================================================
# KAVACH Sovereign Document AI - Frontend Dockerfile
# Multi-stage build: Node 20 (builder) -> Nginx Alpine (production server)
# ==============================================================================

# Stage 1: Build React/TypeScript application
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first to leverage Docker layer caching
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build production bundle with relative API base for Nginx reverse proxy
ENV VITE_API_BASE_URL=/api
RUN npm run build

# Stage 2: Production Nginx web server
FROM nginx:alpine

# Remove default Nginx config
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets from build stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Healthcheck to ensure Nginx is serving
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
