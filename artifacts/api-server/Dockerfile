# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:24-slim AS build

WORKDIR /app
RUN npm install -g pnpm@10.26.1

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.base.json ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

RUN pnpm install --frozen-lockfile

WORKDIR /app/artifacts/api-server
RUN pnpm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
# Lean image — only the compiled bundle + production node_modules.
# esbuild bundles most code; @whiskeysockets/baileys is externalized so it must
# be present in node_modules at runtime.
FROM node:24-slim

WORKDIR /app
RUN npm install -g pnpm@10.26.1

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.base.json ./
COPY lib/ ./lib/
COPY artifacts/api-server/package.json ./artifacts/api-server/package.json

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist

EXPOSE 8080
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
