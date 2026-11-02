# syntax=docker/dockerfile:1
# Multi-stage build: deps -> builder -> runner.
# Image akhir hanya berisi output standalone Next.js, tanpa source code dan devDependencies.

FROM node:24-slim AS base
# Prisma query engine butuh OpenSSL
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- Install dependencies (di-cache selama package*.json tidak berubah) ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# --- Menjalankan schema sync ke database (dipakai docker-compose) ---
FROM deps AS migrator
CMD ["npx", "prisma", "db", "push", "--skip-generate"]

# --- Build aplikasi ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Nilai dummy hanya agar validasi env lolos saat build; nilai asli diberikan saat container jalan
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Image produksi ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Pastikan Prisma client + query engine ikut terbawa
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
