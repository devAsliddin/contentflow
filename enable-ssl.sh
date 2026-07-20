#!/usr/bin/env bash
set -euo pipefail
DOMAIN=contentflow.uz
EMAIL=admin@contentflow.uz
cd /opt/contentflow
echo "[ssl] Getting certificate for $DOMAIN..."
docker compose run --rm certbot certonly --webroot -w /var/www/certbot --non-interactive --agree-tos --email "$EMAIL" -d "$DOMAIN" -d "www.$DOMAIN"
sed -i "s|DOMAIN|$DOMAIN|g" devops/nginx/nginx-compose.conf
sed -i "s|nginx-init.conf|nginx-compose.conf|g" docker-compose.yml
docker compose restart nginx
sleep 3
curl -s -o /dev/null -w "HTTPS Status: %{http_code}" https://$DOMAIN/api/health
echo ""
echo "[ssl] Done! ContentFlow: https://$DOMAIN"

