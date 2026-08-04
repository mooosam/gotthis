# ── Build stage ───────────────────────────────────────────────────────────────
# Compiles the TypeScript monorepo into a single esbuild bundle.
FROM node:24-alpine AS build

WORKDIR /app
RUN npm install -g pnpm

# Workspace manifests — cached layer if only source changes
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.base.json ./

# All lib packages + the API server source
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

RUN pnpm install --frozen-lockfile

WORKDIR /app/artifacts/api-server
RUN pnpm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
# Lean image — only the compiled bundle + production node_modules.
# esbuild bundles most code (including Gemini SDK, drizzle-orm, mysql2).
# @whiskeysockets/baileys is externalized so it must be in node_modules here.
FROM node:24-alpine

WORKDIR /app
RUN npm install -g pnpm

# Workspace manifests needed so pnpm can resolve workspace: references
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.base.json ./
COPY lib/ ./lib/
COPY artifacts/api-server/package.json ./artifacts/api-server/package.json

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Compiled bundle from the build stage
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist

EXPOSE 8080

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
