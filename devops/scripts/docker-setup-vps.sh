#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# ContentFlow — VPS Initial Setup Script (Docker edition)
# Tested on: Ubuntu 22.04 LTS
# Run as root: bash devops/scripts/docker-setup-vps.sh
# ─────────────────────────────────────────────────────────────────────────────

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_step()    { echo -e "\n${BOLD}${CYAN}==> $*${NC}"; }

APP_USER="contentflow"
APP_DIR="/opt/contentflow"
BACKUP_DIR="/var/backups/contentflow"
REPO_URL="${REPO_URL:-https://github.com/YOUR_ORG/contentflow.git}"

# ── Require root ──────────────────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  log_error "This script must be run as root."
  exit 1
fi

# ── Require Ubuntu 22.04 ──────────────────────────────────────────────────────
if ! grep -qi 'ubuntu 22' /etc/os-release 2>/dev/null; then
  log_warn "This script targets Ubuntu 22.04. Proceed with caution on other distros."
fi

log_step "Updating system packages"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git unzip gnupg ca-certificates \
  lsb-release software-properties-common \
  fail2ban ufw cron
log_success "System packages updated"

# ── Docker CE ─────────────────────────────────────────────────────────────────
log_step "Installing Docker CE (official repo)"
if command -v docker &>/dev/null; then
  log_warn "Docker already installed: $(docker --version)"
else
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  log_success "Docker CE installed: $(docker --version)"
fi

# ── Docker Compose plugin check ───────────────────────────────────────────────
if ! docker compose version &>/dev/null; then
  log_error "Docker Compose plugin not found. Install docker-compose-plugin."
  exit 1
fi
log_success "Docker Compose: $(docker compose version --short)"

# ── UFW Firewall ──────────────────────────────────────────────────────────────
log_step "Configuring UFW firewall"
ufw --force reset > /dev/null 2>&1
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
# Allow Docker internal networking
ufw allow in on docker0
ufw --force enable
log_success "UFW configured (22, 80, 443 open)"

# ── fail2ban ──────────────────────────────────────────────────────────────────
log_step "Configuring fail2ban"
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
backend  = systemd

[sshd]
enabled = true
port    = ssh
filter  = sshd
maxretry = 3

[nginx-http-auth]
enabled = false
EOF
systemctl enable --now fail2ban
log_success "fail2ban configured"

# ── Application user ──────────────────────────────────────────────────────────
log_step "Creating application user: ${APP_USER}"
if id "$APP_USER" &>/dev/null; then
  log_warn "User '${APP_USER}' already exists"
else
  useradd -m -s /bin/bash "$APP_USER"
  log_success "User '${APP_USER}' created"
fi
usermod -aG docker "$APP_USER"
log_success "User '${APP_USER}' added to docker group"

# ── Application directory ─────────────────────────────────────────────────────
log_step "Creating application directory: ${APP_DIR}"
mkdir -p "$APP_DIR"
mkdir -p "$BACKUP_DIR"
chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
chown -R "${APP_USER}:${APP_USER}" "$BACKUP_DIR"
chmod 750 "$APP_DIR"
chmod 750 "$BACKUP_DIR"
log_success "Directories created"

# ── Copy deploy scripts into place ────────────────────────────────────────────
log_step "Making scripts executable (post-clone)"
# Scripts will be executable after git clone — this is a reminder step.
log_info "After cloning, run:"
log_info "  chmod +x ${APP_DIR}/devops/scripts/*.sh"

# ── Cron jobs ─────────────────────────────────────────────────────────────────
log_step "Setting up cron jobs"
CRON_FILE="/etc/cron.d/contentflow"
cat > "$CRON_FILE" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Daily database backup at 02:00
0 2 * * * ${APP_USER} bash ${APP_DIR}/devops/scripts/docker-backup.sh >> /var/log/contentflow-backup.log 2>&1

# SSL certificate renewal check every 12 hours
0 */12 * * * ${APP_USER} cd ${APP_DIR} && docker compose run --rm certbot certbot renew --webroot -w /var/www/certbot --quiet >> /var/log/contentflow-ssl-renew.log 2>&1
EOF
chmod 644 "$CRON_FILE"
log_success "Cron jobs installed at ${CRON_FILE}"

# ── Log files ─────────────────────────────────────────────────────────────────
touch /var/log/contentflow-backup.log
touch /var/log/contentflow-ssl-renew.log
chown "$APP_USER:$APP_USER" /var/log/contentflow-backup.log
chown "$APP_USER:$APP_USER" /var/log/contentflow-ssl-renew.log

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}VPS setup complete!${NC}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo -e "  1. Clone the repository:"
echo -e "     ${CYAN}cd /opt && git clone ${REPO_URL} contentflow${NC}"
echo ""
echo -e "  2. Set up environment:"
echo -e "     ${CYAN}cp ${APP_DIR}/.env.example ${APP_DIR}/.env${NC}"
echo -e "     ${CYAN}nano ${APP_DIR}/.env${NC}  # Fill in all required values"
echo ""
echo -e "  3. Make scripts executable:"
echo -e "     ${CYAN}chmod +x ${APP_DIR}/devops/scripts/*.sh${NC}"
echo ""
echo -e "  4. Obtain initial SSL certificate:"
echo -e "     ${CYAN}cd ${APP_DIR} && make ssl-init DOMAIN=yourdomain.com EMAIL=admin@yourdomain.com${NC}"
echo ""
echo -e "  5. Start with HTTP-only config first (for certbot ACME challenge):"
echo -e "     ${CYAN}cp ${APP_DIR}/devops/nginx/nginx-init.conf /etc/nginx/conf.d/contentflow.conf${NC}"
echo ""
echo -e "  6. Deploy:"
echo -e "     ${CYAN}cd ${APP_DIR} && bash devops/scripts/docker-deploy.sh${NC}"
echo ""
echo -e "  Server info:"
echo -e "    Public IP : $(curl -4 -sf https://ifconfig.me || echo 'unknown')"
echo -e "    App dir   : ${APP_DIR}"
echo -e "    Backups   : ${BACKUP_DIR}"
echo -e "    App user  : ${APP_USER}"
echo ""
