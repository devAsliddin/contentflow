#!/usr/bin/env bash
# ContentFlow VPS Setup Script
# Run as root on Ubuntu 22.04
# Usage: bash setup_vps.sh

set -euo pipefail

echo "==> ContentFlow VPS Setup"
echo "==> Ubuntu 22.04 required"

# ──── System updates ────────────────────────────────────────────────
echo "==> Updating system packages..."
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  curl wget git gnupg2 software-properties-common \
  apt-transport-https ca-certificates lsb-release \
  ufw fail2ban unzip build-essential

# ──── Python 3.11 ───────────────────────────────────────────────────
echo "==> Installing Python 3.11..."
add-apt-repository ppa:deadsnakes/ppa -y
apt-get update -y
apt-get install -y python3.11 python3.11-venv python3.11-dev python3-pip
update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# ──── Node.js 20 ────────────────────────────────────────────────────
echo "==> Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g npm@latest

# ──── PostgreSQL 15 ─────────────────────────────────────────────────
echo "==> Installing PostgreSQL 15..."
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt-get update -y
apt-get install -y postgresql-15 postgresql-client-15

systemctl enable postgresql
systemctl start postgresql

# Create database + user
sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'contentflow') THEN
    CREATE USER contentflow WITH PASSWORD 'CHANGE_THIS_PASSWORD';
  END IF;
END
\$\$;
CREATE DATABASE contentflow OWNER contentflow;
GRANT ALL PRIVILEGES ON DATABASE contentflow TO contentflow;
SQL

# ──── Redis ─────────────────────────────────────────────────────────
echo "==> Installing Redis..."
apt-get install -y redis-server
systemctl enable redis-server
systemctl start redis-server

# ──── Nginx ─────────────────────────────────────────────────────────
echo "==> Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx

# ──── Create contentflow user ───────────────────────────────────────
echo "==> Creating contentflow system user..."
if ! id "contentflow" &>/dev/null; then
  useradd -m -s /bin/bash -d /home/contentflow contentflow
  usermod -aG sudo contentflow
fi

# ──── App directories ───────────────────────────────────────────────
echo "==> Creating app directories..."
mkdir -p /var/www/contentflow
mkdir -p /etc/contentflow
mkdir -p /var/log/contentflow
mkdir -p /var/backups/contentflow
mkdir -p /var/www/contentflow/media

chown -R contentflow:contentflow /var/www/contentflow
chown -R contentflow:contentflow /etc/contentflow
chown -R contentflow:contentflow /var/log/contentflow
chown -R contentflow:contentflow /var/backups/contentflow
chmod 700 /etc/contentflow

# ──── Firewall (UFW) ────────────────────────────────────────────────
echo "==> Configuring UFW firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

# ──── fail2ban ──────────────────────────────────────────────────────
echo "==> Configuring fail2ban..."
cat > /etc/fail2ban/jail.local <<EOF
[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# ──── Python virtualenv for app ─────────────────────────────────────
echo "==> Creating Python virtual environment..."
sudo -u contentflow python3.11 -m venv /var/www/contentflow/venv

echo ""
echo "==> Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy your app: git clone YOUR_GITHUB_REPO /var/www/contentflow"
echo "  2. Configure /etc/contentflow/.env"
echo "  3. Run: bash /var/www/contentflow/devops/scripts/deploy.sh"
echo ""
echo "IMPORTANT: Change the PostgreSQL password 'CHANGE_THIS_PASSWORD' in production!"
