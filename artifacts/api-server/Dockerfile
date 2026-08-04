# Build stage
FROM node:24-alpine AS build

WORKDIR /app
RUN npm install -g pnpm

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.base.json ./

# Copy only the packages the API server needs
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

RUN pnpm install --frozen-lockfile

# Build the API bundle
WORKDIR /app/artifacts/api-server
RUN pnpm run build

# ─────────────────────────────────────────────────────────────────────────────
# Runtime stage (lean image — no source, no dev deps)
FROM node:24-alpine

WORKDIR /app

RUN npm install -g pnpm

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.base.json ./
COPY lib/ ./lib/
COPY artifacts/api-server/package.json ./artifacts/api-server/package.json

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled bundle from build stage
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist

EXPOSE 8080

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
