# ContentFlow DevOps

## Quick Start

### 1. First-time VPS setup
```bash
scp devops/scripts/setup_vps.sh root@YOUR_VPS_IP:/tmp/
ssh root@YOUR_VPS_IP "bash /tmp/setup_vps.sh"
```

### 2. Configure environment
```bash
sudo nano /etc/contentflow/.env
# Fill in all values from backend/.env.example
```

### 3. Clone and deploy
```bash
cd /var/www/contentflow
git clone YOUR_GITHUB_REPO .
bash devops/scripts/deploy.sh
```

### 4. Install systemd services
```bash
sudo cp devops/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable contentflow-backend contentflow-celery
sudo systemctl start contentflow-backend contentflow-celery
```

### 5. Configure Nginx
```bash
sudo cp devops/nginx/contentflow.conf /etc/nginx/sites-available/contentflow
sudo ln -s /etc/nginx/sites-available/contentflow /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. Set up backup cron
```bash
echo "0 2 * * * contentflow bash /var/www/contentflow/devops/scripts/backup.sh" | sudo tee -a /etc/crontab
```

## Service Management

```bash
# Status
sudo systemctl status contentflow-backend
sudo systemctl status contentflow-celery

# Logs
journalctl -u contentflow-backend -f
journalctl -u contentflow-celery -f

# Restart all
bash devops/scripts/restart_services.sh
```
