# Build stage — compiles the React/Vite app into static files
FROM node:24-alpine AS build

WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.base.json ./
COPY lib/ ./lib/
COPY artifacts/web/ ./artifacts/web/

RUN pnpm install --frozen-lockfile

# VITE_CLERK_PUBLISHABLE_KEY must be available at build time
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

WORKDIR /app/artifacts/web
RUN pnpm run build

# ─────────────────────────────────────────────────────────────────────────────
# Runtime stage — serve the built static files
FROM nginx:alpine

COPY --from=build /app/artifacts/web/dist /usr/share/nginx/html

# SPA fallback: all unmatched paths → index.html (React Router handles them)
RUN printf 'server {\n  listen 3000;\n  root /usr/share/nginx/html;\n  location / { try_files $uri $uri/ /index.html; }\n}\n' \
    > /etc/nginx/conf.d/default.conf

EXPOSE 3000
