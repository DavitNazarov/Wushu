# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# [FUTURE HETZNER MIGRATION] — NOT USED BY THE CURRENT RENDER DEPLOYMENT.
#
# This Dockerfile builds the COMBINED single-process server (server.js) for a
# future self-hosted Hetzner deployment. It is intentionally kept under
# deploy/hetzner/ (NOT at the repo root) so Render's native Node runtime does
# not auto-detect it. To use it later:  see deploy/hetzner/README.md.
#
#   Build from the REPO ROOT:
#     docker build -f deploy/hetzner/Dockerfile -t geo-wushu:latest .
# ─────────────────────────────────────────────────────────────────────────────

# ---- Stage 1: builder ----------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Install workspace manifests first for better layer caching.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# Full install (dev deps required for `nest build` and `next build`).
RUN npm ci

# Copy the rest of the source and build both workspaces.
COPY . .
# `prisma generate` (in backend build) needs the schema; nest build -> dist/,
# next build -> .next/.
RUN npm run build

# Drop dev dependencies to slim the node_modules we carry into the runner.
RUN npm prune --omit=dev


# ---- Stage 2: runner -----------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# server.js reads PORT (defaults to 4000). nginx (see nginx.conf) proxies to it.
ENV PORT=4000

# Run as the unprivileged 'node' user shipped in the base image.
USER node

# Combined entry point + root manifest/scripts.
COPY --chown=node:node --from=builder /app/server.js ./server.js
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/node_modules ./node_modules

# Backend: built dist, Prisma schema + migrations (needed by db:deploy at boot),
# and the idempotent migration scripts.
COPY --chown=node:node --from=builder /app/backend/dist ./backend/dist
COPY --chown=node:node --from=builder /app/backend/prisma ./backend/prisma
COPY --chown=node:node --from=builder /app/backend/scripts ./backend/scripts
COPY --chown=node:node --from=builder /app/backend/package.json ./backend/package.json

# Frontend: built output + config + static assets.
COPY --chown=node:node --from=builder /app/frontend/.next ./frontend/.next
COPY --chown=node:node --from=builder /app/frontend/public ./frontend/public
COPY --chown=node:node --from=builder /app/frontend/next.config.ts ./frontend/next.config.ts
COPY --chown=node:node --from=builder /app/frontend/package.json ./frontend/package.json

EXPOSE 4000

# Liveness check mirrors the Render health check path.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrations are run as a one-shot step by docker-compose (see the `migrate`
# service in docker-compose.prod.yml), NOT here, so a multi-replica rollout
# does not race. The app just starts the server.
CMD ["node", "server.js"]
