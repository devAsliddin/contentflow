#!/usr/bin/env bash
# Restart all ContentFlow services
set -euo pipefail

echo "Restarting ContentFlow services..."
sudo systemctl restart contentflow-backend
sudo systemctl restart contentflow-celery
sudo systemctl reload nginx

echo "Service status:"
sudo systemctl status contentflow-backend --no-pager -l | tail -5
sudo systemctl status contentflow-celery --no-pager -l | tail -5
echo "Done."
