# ContentFlow — Setup Guide

## 1. Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Git

### Clone & Setup

```bash
git clone YOUR_GITHUB_REPO
cd contentflow
```

### Backend Setup

```bash
cd backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env from template
cp .env.example .env
# Edit .env with your values

# Create database
createdb contentflow

# Run migrations
alembic upgrade head

# Start FastAPI
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In another terminal — start Celery worker
celery -A app.tasks.celery_app worker --loglevel=info
```

Backend available at: http://localhost:8000
API docs at: http://localhost:8000/api/docs

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env.local

# Start dev server
npm run dev
```

Frontend available at: http://localhost:5173

---

## 2. VPS Deployment (Ubuntu 22.04)

### Step 1 — First-time VPS setup

```bash
# SSH into VPS as root
ssh root@YOUR_VPS_IP

# Upload and run setup script
scp devops/scripts/setup_vps.sh root@YOUR_VPS_IP:/tmp/
ssh root@YOUR_VPS_IP "bash /tmp/setup_vps.sh"
```

This script will:
- Update system packages
- Install Python 3.11, Node.js 20, PostgreSQL 15, Redis, Nginx, Git
- Create `contentflow` system user
- Configure UFW firewall (ports 22, 80, 443)
- Install fail2ban
- Create /var/www/contentflow directory

### Step 2 — Configure environment

```bash
# SSH as contentflow user
ssh contentflow@YOUR_VPS_IP

# Create .env (or copy and edit)
sudo mkdir -p /etc/contentflow
sudo cp /var/www/contentflow/backend/.env.example /etc/contentflow/.env
sudo nano /etc/contentflow/.env
sudo chmod 600 /etc/contentflow/.env
sudo chown contentflow:contentflow /etc/contentflow/.env
```

### Step 3 — Install systemd services

```bash
sudo cp devops/systemd/contentflow-backend.service /etc/systemd/system/
sudo cp devops/systemd/contentflow-celery.service /etc/systemd/system/
sudo cp devops/systemd/contentflow-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable contentflow-backend contentflow-celery
```

### Step 4 — Configure Nginx

```bash
sudo cp devops/nginx/contentflow.conf /etc/nginx/sites-available/contentflow
sudo ln -s /etc/nginx/sites-available/contentflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 5 — Deploy

```bash
cd /var/www/contentflow
bash devops/scripts/deploy.sh
```

The deploy script:
1. Pulls latest from GitHub
2. Installs Python deps
3. Runs DB migrations
4. Builds React frontend
5. Restarts all systemd services
6. Runs health check
7. Rolls back on failure

### Step 6 — Verify

```bash
# Check services
sudo systemctl status contentflow-backend
sudo systemctl status contentflow-celery

# Check health endpoint
curl http://YOUR_VPS_IP/api/health

# Check logs
journalctl -u contentflow-backend -f
journalctl -u contentflow-celery -f
```

### Useful commands

```bash
# Restart all services
bash /var/www/contentflow/devops/scripts/restart_services.sh

# View backend logs
journalctl -u contentflow-backend -n 100

# Celery logs
journalctl -u contentflow-celery -n 100

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Run backup manually
bash /var/www/contentflow/devops/scripts/backup.sh
```
