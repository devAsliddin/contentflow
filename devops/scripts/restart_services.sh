#!/usr/bin/env bash
# Restart all ContentFlow services
set -euo pipefail

echo "Restarting ContentFlow services..."
sudo systemctl restart contentflow-backend
sudo systemctl restart contentflow-celery
sudo systemctl restart contentflow-celery-analysis
sudo systemctl restart contentflow-celery-images
sudo systemctl restart contentflow-celery-beat
sudo systemctl reload nginx

echo "Service status:"
sudo systemctl status contentflow-backend              --no-pager -l | tail -5
sudo systemctl status contentflow-celery               --no-pager -l | tail -5
sudo systemctl status contentflow-celery-analysis      --no-pager -l | tail -5
sudo systemctl status contentflow-celery-images        --no-pager -l | tail -5
sudo systemctl status contentflow-celery-beat          --no-pager -l | tail -5
echo "Done."
