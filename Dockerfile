# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build


FROM node:22-bookworm-slim AS backend-deps

WORKDIR /app/backend

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force


FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=80
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    dumb-init \
    fonts-liberation \
    libcap2-bin \
  && setcap 'cap_net_bind_service=+ep' /usr/local/bin/node \
  && rm -rf /var/lib/apt/lists/*

COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY --from=frontend-build /app/frontend/dist ./public

RUN mkdir -p uploads \
  && chown -R node:node /app

USER node

VOLUME ["/app/uploads"]

EXPOSE 80 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 80) + '/api/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["dumb-init", "node", "backend/server.js"]
