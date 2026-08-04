# Self-Hosting The Ritual AI on Oracle Cloud Free Tier

Deploy the full stack (API + frontend + MySQL) on Oracle Cloud's always-free
Ampere VM using Docker Compose — no Kubernetes, no managed services required.

---

## Architecture

```
Internet
   │
   ▼
nginx:443/80          (reverse proxy + TLS)
   ├── /api/  ──────► api:8080    (Node.js / Express)
   └── /      ──────► web:3000    (nginx serving React static files)

api ──────────────────► mysql:3306
migrate (one-shot) ───► mysql:3306   (applies schema on first boot)
```

---

## 1. Provision an Oracle Cloud VM

### Compute instance
- Go to **Compute → Instances → Create Instance**
- Image: **Ubuntu 22.04**
- Shape: **VM.Standard.A1.Flex** — 4 OCPU / 24 GB RAM, always free on Ampere ARM64
  - (Or **VM.Standard.E2.1.Micro** for very light load — 1 OCPU / 1 GB)
- Generate or upload an SSH key

### Open firewall ports (VCN Security List)
Add ingress rules for:
| Port | Protocol | Purpose |
|------|----------|---------|
| 22   | TCP | SSH |
| 80   | TCP | HTTP |
| 443  | TCP | HTTPS |

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

# Create your .env from the template
cp .env.example .env
nano .env          # fill in every value — see table below
```

### Required `.env` values

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Leave as-is: `mysql://ritual:yourpassword@mysql:3306/ritual_ai` |
| `MYSQL_PASSWORD` | Pick a strong password — must match the one in `DATABASE_URL` |
| `MYSQL_ROOT_PASSWORD` | Pick a different strong password for the MySQL root user |
| `CLERK_PUBLISHABLE_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) → API Keys |
| `CLERK_SECRET_KEY` | Same |
| `VITE_CLERK_PUBLISHABLE_KEY` | Same as `CLERK_PUBLISHABLE_KEY` |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `SESSION_SECRET` | Any random 32+ character string |
| `PHONE_PEPPER` | Any random 32+ character string (different from SESSION_SECRET) |
| `APP_URL` | `https://yourdomain.com` (your public domain) |
| `ADMIN_BOOTSTRAP_EMAIL` | Your admin email address |

Stripe and Resend keys are optional — the app runs without them but paid plans
and newsletters won't work.

---

## 4. Point your domain at the VM

In your DNS provider, add an **A record** pointing `yourdomain.com` → the VM's
public IP address. Wait for propagation (usually a few minutes).

---

## 5. Build and start

```bash
# First boot — builds all images and applies the DB schema (~5-10 min)
docker compose up -d --build

# Watch the logs
docker compose logs -f
```

What happens on first boot:
1. **mysql** starts and initialises the database
2. **migrate** runs `drizzle-kit push` to create all tables, then exits
3. **api** starts once migration succeeds
4. **web** and **nginx** start in parallel

---

## 6. Connect WhatsApp

Once the stack is running, open your domain in a browser and navigate to the
WhatsApp QR page. Scan the QR with your WhatsApp account.

The session is stored in the `whatsapp_auth` Docker volume and survives
container restarts automatically.

---

## 7. Enable HTTPS with Let's Encrypt (strongly recommended)

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain a certificate (nginx must already be serving port 80)
sudo certbot --nginx -d yourdomain.com

# Uncomment the HTTPS server blocks in deploy/nginx.conf
nano deploy/nginx.conf

# Reload nginx inside the container
docker compose exec nginx nginx -s reload
```

Certbot auto-renews the certificate. The `docker-compose.yml` already has a
commented-out volume mount for `/etc/letsencrypt` — uncomment it after running
certbot.

---

## 8. Useful commands

```bash
# View all logs
docker compose logs -f

# View API logs only
docker compose logs -f api

# Restart the API (e.g. after a config change)
docker compose restart api

# Pull latest code and redeploy
git pull
docker compose up -d --build

# Re-run migrations after a schema change
docker compose run --rm migrate

# Open a MySQL shell
docker compose exec mysql mysql -u ritual -p ritual_ai

# Stop everything
docker compose down

# Stop everything and delete the database (destructive!)
docker compose down -v
```

---

## 9. Environment variable reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | MySQL connection string |
| `MYSQL_PASSWORD` | ✅ | MySQL `ritual` user password |
| `MYSQL_ROOT_PASSWORD` | ✅ | MySQL root password |
| `CLERK_PUBLISHABLE_KEY` | ✅ | Clerk public key |
| `CLERK_SECRET_KEY` | ✅ | Clerk secret key |
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ | Same as `CLERK_PUBLISHABLE_KEY` (baked into frontend build) |
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `SESSION_SECRET` | ✅ | Random 32+ char string for session signing |
| `PHONE_PEPPER` | ✅ | Random 32+ char string for phone number hashing |
| `APP_URL` | ✅ | Public URL (`https://yourdomain.com`) |
| `ADMIN_BOOTSTRAP_EMAIL` | ✅ | Email for the first admin account |
| `ADMIN_USER_IDS` | ⚠️ | Comma-separated Clerk user IDs for admin access |
| `STRIPE_SECRET_KEY` | Optional | Required for paid plans |
| `STRIPE_WEBHOOK_SECRET` | Optional | Required for Stripe webhooks |
| `RESEND_API_KEY` | Optional | Required for email newsletters |
| `EMAIL_FROM` | Optional | Sender address for newsletters |
