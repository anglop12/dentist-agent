# ============================================================
# Agente Odontológico IA - imagen única de desarrollo/testing
# Compila con tsc (nest build) → emitDecoratorMetadata OK.
# El entrypoint aplica migraciones SQL antes de arrancar.
# ============================================================
FROM node:22-alpine

WORKDIR /app

# Toolchain para compilar better-sqlite3 en musl (alpine)
RUN apk add --no-cache python3 make g++ \
    && corepack enable

# 1) Manifiestos para capa cacheable de dependencias
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/

# 2) Dependencias (usa la versión de pnpm fijada en packageManager)
RUN pnpm install --frozen-lockfile

# 3) Código fuente + migraciones
COPY tsconfig.json ./
COPY apps/api apps/api
COPY db db

# 4) Compilar API (tsc vía nest build → src únicamente)
RUN pnpm --filter @dentist/api exec nest build

ENV NODE_ENV=production \
    APP_PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=5 --start-period=40s \
  CMD wget -qO- http://127.0.0.1:3000/healthz > /dev/null 2>&1 || exit 1

# Aplica migraciones (idempotente) y arranca la API.
# El worker de jobs corre IN-PROCESS (JobsModule), no hace falta otro contenedor.
CMD ["sh", "-c", "node apps/api/migrate.cjs && node apps/api/dist/main.js"]
