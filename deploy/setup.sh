#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# The Ritual AI — Oracle Cloud Ubuntu server setup
# Run once after provisioning the VM:
#   chmod +x deploy/setup.sh && sudo ./deploy/setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        The Ritual AI — Server Setup                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. System update ──────────────────────────────────────────────────────────
echo "▶ Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. Install Docker ─────────────────────────────────────────────────────────
echo "▶ Installing Docker..."
apt-get install -y -qq docker.io docker-compose-plugin git curl

systemctl enable docker
systemctl start docker

# Add the current non-root user to the docker group (if not root)
if [ -n "${SUDO_USER:-}" ]; then
  usermod -aG docker "$SUDO_USER"
  echo "   Added $SUDO_USER to the docker group."
fi

# ── 3. Open ports 80 and 443 in the OS firewall ───────────────────────────────
# Oracle Cloud Ubuntu images ship with iptables rules that block all ports
# by default — even if you've opened them in the VCN Security List.
echo "▶ Opening ports 80 and 443 in iptables..."

iptables  -I INPUT  6 -m state --state NEW -p tcp --dport 80  -j ACCEPT
iptables  -I INPUT  7 -m state --state NEW -p tcp --dport 443 -j ACCEPT
ip6tables -I INPUT  6 -m state --state NEW -p tcp --dport 80  -j ACCEPT
ip6tables -I INPUT  7 -m state --state NEW -p tcp --dport 443 -j ACCEPT

# Persist the rules so they survive reboots
apt-get install -y -qq iptables-persistent
netfilter-persistent save

# ── 4. Done ───────────────────────────────────────────────────────────────────
echo ""
echo "✅ Done! Docker and firewall rules are ready."
echo ""
echo "Next steps:"
echo "  1. Log out and back in (so your user picks up the docker group)"
echo "  2. cd into the repo and run:  cp .env.example .env  then  nano .env"
echo "  3. docker compose up -d --build"
echo ""
