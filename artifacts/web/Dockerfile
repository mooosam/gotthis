# ── Build stage ───────────────────────────────────────────────────────────────
# node:24-slim (Debian/glibc) matches the libc used when the pnpm lockfile was
# generated on Replit, so rollup's native binary resolves correctly.
FROM node:24-slim AS build

WORKDIR /app
RUN npm install -g pnpm@10.26.1

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.base.json ./
COPY lib/ ./lib/
COPY artifacts/web/ ./artifacts/web/

# --no-frozen-lockfile lets pnpm install the correct platform-specific optional
# dep (e.g. @rollup/rollup-linux-x64-gnu) without the lockfile blocking it.
RUN pnpm install --no-frozen-lockfile

# These are needed at build time:
#   VITE_CLERK_PUBLISHABLE_KEY — baked into the JS bundle by Vite
#   PORT / BASE_PATH — read by vite.config.ts even during `vite build`
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV PORT=3000
ENV BASE_PATH=/

WORKDIR /app/artifacts/web
RUN pnpm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
# Serve the compiled static files with nginx.
# vite.config.ts sets outDir to dist/public — copy from there.
FROM nginx:alpine

COPY --from=build /app/artifacts/web/dist/public /usr/share/nginx/html

RUN printf 'server {\n\
  listen 3000;\n\
  root /usr/share/nginx/html;\n\
  gzip on;\n\
  gzip_types text/plain text/css application/javascript application/json;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
    add_header Cache-Control "no-cache";\n\
  }\n\
  location /assets/ {\n\
    add_header Cache-Control "public, max-age=31536000, immutable";\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
