# ── Build stage ───────────────────────────────────────────────────────────────
# Compiles the React/Vite app into static files.
FROM node:24-slim AS build

WORKDIR /app
RUN npm install -g pnpm@10.26.1

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.base.json ./
COPY lib/ ./lib/
COPY artifacts/web/ ./artifacts/web/

RUN pnpm install --no-frozen-lockfile

# VITE_CLERK_PUBLISHABLE_KEY must be available at build time —
# it gets baked into the JS bundle by Vite.
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

WORKDIR /app/artifacts/web
RUN pnpm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
# Serve the compiled static files with nginx.
FROM nginx:alpine

COPY --from=build /app/artifacts/web/dist /usr/share/nginx/html

# SPA fallback: all unmatched paths → index.html so React Router works
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
