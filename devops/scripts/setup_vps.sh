#!/usr/bin/env bash
# ContentFlow VPS Setup Script
# Run as root on Ubuntu 22.04
# Usage: bash setup_vps.sh YOUR_DOMAIN your@email.com

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: bash setup_vps.sh YOUR_DOMAIN your@email.com"
  exit 1
fi

echo "==> ContentFlow VPS Setup — domain=$DOMAIN"

# ──── System updates ────────────────────────────────────────────────
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  curl wget git gnupg2 software-properties-common \
  apt-transport-https ca-certificates lsb-release \
  ufw fail2ban unzip build-essential

# ──── Python 3.11 ───────────────────────────────────────────────────
add-apt-repository ppa:deadsnakes/ppa -y
apt-get update -y
apt-get install -y python3.11 python3.11-venv python3.11-dev python3-pip
update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# ──── Node.js 20 ────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g npm@latest

# ──── PostgreSQL 15 ─────────────────────────────────────────────────
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt-get update -y
apt-get install -y postgresql-15 postgresql-client-15
systemctl enable postgresql
systemctl start postgresql

# Generate a strong random DB password
DB_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)

sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'contentflow') THEN
    CREATE USER contentflow WITH PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
CREATE DATABASE contentflow OWNER contentflow;
GRANT ALL PRIVILEGES ON DATABASE contentflow TO contentflow;
SQL

echo "DB_PASS=${DB_PASS}" > /etc/contentflow_db_pass.txt
chmod 600 /etc/contentflow_db_pass.txt
echo "==> PostgreSQL password saved to /etc/contentflow_db_pass.txt"

# ──── Redis (with AOF persistence so tasks survive restart) ─────────
apt-get install -y redis-server
# Enable AOF persistence
sed -i 's/^appendonly no/appendonly yes/' /etc/redis/redis.conf
sed -i 's/^appendfsync .*/appendfsync everysec/' /etc/redis/redis.conf
# Bind to localhost only
sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf
systemctl enable redis-server
systemctl restart redis-server

# ──── Nginx ─────────────────────────────────────────────────────────
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx

# ──── Certbot (Let's Encrypt SSL) ───────────────────────────────────
apt-get install -y certbot python3-certbot-nginx
# Create webroot for ACME challenge
mkdir -p /var/www/certbot
# Obtain certificate (Nginx must be running with HTTP server block)
certbot certonly \
  --nginx \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN" \
  -d "www.$DOMAIN" || echo "WARNING: certbot failed — run manually after DNS is ready"

# Auto-renew cron
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --nginx") | crontab -

# ──── Create contentflow system user ───────────────────────────────
if ! id "contentflow" &>/dev/null; then
  useradd -m -s /bin/bash -d /home/contentflow contentflow
fi

# ──── App directories ───────────────────────────────────────────────
mkdir -p /var/www/contentflow
mkdir -p /var/www/contentflow/media
mkdir -p /var/www/html/contentflow
mkdir -p /etc/contentflow
mkdir -p /var/log/contentflow
mkdir -p /var/backups/contentflow

chown -R contentflow:contentflow /var/www/contentflow
chown -R contentflow:contentflow /var/www/html/contentflow
chown -R contentflow:contentflow /etc/contentflow
chown -R contentflow:contentflow /var/log/contentflow
chown -R contentflow:contentflow /var/backups/contentflow
# Nginx needs to read media
chown -R contentflow:www-data /var/www/contentflow/media
chmod -R 750 /var/www/contentflow/media
chmod 700 /etc/contentflow

# Allow contentflow user to manage its own services
cat > /etc/sudoers.d/contentflow <<EOF
contentflow ALL=(ALL) NOPASSWD: /bin/systemctl restart contentflow-backend
contentflow ALL=(ALL) NOPASSWD: /bin/systemctl restart contentflow-celery
contentflow ALL=(ALL) NOPASSWD: /bin/systemctl restart contentflow-celery-beat
contentflow ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
EOF
chmod 440 /etc/sudoers.d/contentflow

# ──── Firewall (UFW) ────────────────────────────────────────────────
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp  comment 'SSH'
ufw allow 80/tcp  comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

# ──── fail2ban ──────────────────────────────────────────────────────
cat > /etc/fail2ban/jail.local <<EOF
[sshd]
enabled  = true
port     = 22
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 3
bantime  = 3600

[nginx-limit-req]
enabled  = true
filter   = nginx-limit-req
logpath  = /var/log/nginx/contentflow_error.log
maxretry = 5
bantime  = 600
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# ──── Python virtualenv ─────────────────────────────────────────────
sudo -u contentflow python3.11 -m venv /var/www/contentflow/venv

echo ""
echo "==> Setup complete!"
echo ""
echo "DB password saved to: /etc/contentflow_db_pass.txt"
echo ""
echo "Next steps:"
echo "  1. git clone YOUR_GITHUB_REPO /var/www/contentflow"
echo "  2. Generate env:"
echo "       python3 -c \"from cryptography.fernet import Fernet; print('ENCRYPTION_KEY=' + Fernet.generate_key().decode())\""
echo "       python3 -c \"import secrets; print('SECRET_KEY=' + secrets.token_hex(32))\""
echo "  3. Fill in /etc/contentflow/.env (see .env.example)"
echo "  4. bash /var/www/contentflow/devops/scripts/deploy.sh"
echo "  5. Replace YOUR_DOMAIN in nginx config: /etc/nginx/sites-enabled/contentflow"
echo "  6. sudo nginx -t && sudo systemctl reload nginx"
