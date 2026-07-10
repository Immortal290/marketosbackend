# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Support both build contexts:
#   - repo root  (Railway root railway.json → marketos-backend/Dockerfile)
#   - subdirectory (marketos-backend/railway.json → Dockerfile)
# We COPY with the subdirectory prefix; Docker resolves whichever exists.
COPY marketos-backend/package*.json    ./
COPY marketos-backend/prisma           ./prisma/
COPY marketos-backend/prisma.config.ts ./

RUN npm ci --ignore-scripts

# ── Stage 2: Build TypeScript ─────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# DATABASE_URL is required by prisma.config.ts at generate time.
ARG DATABASE_URL=postgresql://user:pass@localhost:5432/marketos
ENV DATABASE_URL=${DATABASE_URL}

COPY --from=deps /app/node_modules     ./node_modules
COPY marketos-backend/package*.json    ./
COPY marketos-backend/prisma           ./prisma/
COPY marketos-backend/prisma.config.ts ./
COPY marketos-backend/tsconfig.json    ./
COPY marketos-backend/src              ./src/

RUN node node_modules/.bin/prisma generate
RUN node node_modules/.bin/tsup src

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Production-only Node deps
COPY marketos-backend/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Compiled API + Prisma artifacts
COPY --from=builder /app/prisma            ./prisma/
COPY --from=builder /app/prisma.config.ts  ./
COPY --from=builder /app/node_modules/.prisma  ./node_modules/.prisma/
COPY --from=builder /app/node_modules/@prisma  ./node_modules/@prisma/
COPY --from=builder /app/dist              ./dist/

EXPOSE 3000

# Start the server — Railway startCommand in railway.json handles migrations
CMD ["node", "dist/server.js"]

