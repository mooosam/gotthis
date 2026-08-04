# Self-Hosting The Ritual AI on Oracle Cloud Free Tier

This guide walks you through deploying the app on Oracle Cloud's always-free
compute (VM) with MySQL HeatWave Free Tier.

---

## Prerequisites

- An Oracle Cloud account (free tier is sufficient)
- A domain name pointed at your server's public IP
- Docker + Docker Compose installed on your VM

---

## 1. Provision Oracle Cloud resources

### Compute instance
- Go to **Compute → Instances → Create Instance**
- Shape: **VM.Standard.A1.Flex** (4 OCPU / 24 GB RAM — always free on Ampere)
  - Or **VM.Standard.E2.1.Micro** (1 OCPU / 1 GB RAM) — suitable for light load
- OS: **Ubuntu 22.04**
- Add an SSH key so you can log in

### Open ports in the VCN security list
In the instance's VCN → Security Lists, add ingress rules for:
- Port **22** (SSH)
- Port **80** (HTTP)
- Port **443** (HTTPS)

### MySQL HeatWave (optional — free tier)
Oracle offers a free MySQL HeatWave instance. Alternatively, just run MySQL
in Docker (simpler, covered below).

---

## 2. Install Docker on the VM

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

---

## 3. Clone the repo and configure

```bash
git clone <your-repo-url> ritual-ai
cd ritual-ai

# Copy the example env file and fill in every value
cp .env.example .env
nano .env
```

### Required values in `.env`

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | `mysql://ritual:yourpassword@mysql:3306/ritual_ai` (use the Docker service name `mysql`) |
| `CLERK_PUBLISHABLE_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) → your app → API Keys |
| `CLERK_SECRET_KEY` | Same as above |
| `VITE_CLERK_PUBLISHABLE_KEY` | Same as `CLERK_PUBLISHABLE_KEY` |
| `GEMINI_API_KEY | [Google AI Studio](https://aistudio.google.com/app/apikey) → Get API Key |
| `SESSION_SECRET` | Any random 32+ character string |
| `PHONE_PEPPER` | Any random 32+ character string |
| `APP_URL` | `https://yourdomain.com` |
| `ADMIN_BOOTSTRAP_EMAIL` | Your admin email |

Stripe and email keys are optional — the app runs without them but paid plans
and newsletters won't work.

---

## 4. Update docker-compose.yml passwords

In `docker-compose.yml`, change the MySQL passwords to match what you set in
`.env`:

```yaml
MYSQL_ROOT_PASSWORD: your-secure-root-password
MYSQL_PASSWORD: yourpassword   # must match DATABASE_URL
```

And in the `api` service environment block:
```yaml
DATABASE_URL: mysql://ritual:yourpassword@mysql:3306/ritual_ai
```

---

## 5. Configure your domain in nginx

Edit `deploy/nginx.conf` and replace `_` with your domain:

```nginx
server_name yourdomain.com www.yourdomain.com;
```

---

## 6. Build and start

```bash
# Build all containers and start in the background
docker compose up -d --build

# Watch logs to confirm everything started cleanly
docker compose logs -f api
```

The first startup runs the database schema push automatically (see the
`scripts/post-merge.sh` hook, or run it manually):

```bash
docker compose exec api sh -c "cd /app && pnpm --filter @workspace/db run push"
```

---

## 7. Set up HTTPS with Let's Encrypt (recommended)

```bash
sudo apt install -y certbot

# Stop nginx temporarily to allow certbot to bind port 80
docker compose stop nginx

# Get a certificate
sudo certbot certonly --standalone -d yourdomain.com

# Uncomment the HTTPS block in deploy/nginx.conf (instructions are in the file)
# Then restart nginx
docker compose start nginx
```

---

## 8. Connecting WhatsApp

1. Visit `https://yourdomain.com/whatsapp` (admin accounts only)
2. Enter your phone number to get a pairing code, or scan the QR code
3. The auth state is persisted in the `whatsapp_auth` Docker volume — it
   survives container restarts

---

## 9. Updating the app

```bash
git pull
docker compose up -d --build
docker compose exec api sh -c "cd /app && pnpm --filter @workspace/db run push"
```

---

## Useful commands

```bash
# View live logs
docker compose logs -f api
docker compose logs -f nginx

# Open a MySQL shell
docker compose exec mysql mysql -u ritual -p ritual_ai

# Restart a single service
docker compose restart api

# Stop everything
docker compose down

# Stop and wipe the database (destructive!)
docker compose down -v
```

---

## Using Oracle MySQL HeatWave instead of Docker MySQL

If you prefer to use Oracle's managed MySQL instead of the Docker container:

1. Provision a **MySQL HeatWave** instance in Oracle Cloud Console
2. Note the endpoint, port, username, and password
3. Remove the `mysql` service from `docker-compose.yml`
4. Update `.env`:
   ```
   DATABASE_URL=mysql://admin:yourpassword@<heatwave-endpoint>:3306/ritual_ai
   ```
5. Update `docker-compose.yml` — remove the `depends_on: mysql` condition from
   the `api` service, or replace it with a simple startup delay

---

## Architecture overview

```
Internet → nginx (80/443)
              ├── /api/* → api:8080  (Node.js Express + Baileys)
              └── /*     → web:3000  (React static files)
                              │
                          mysql:3306 (MySQL 8.0)
```
