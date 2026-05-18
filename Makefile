.PHONY: help up down build logs restart shell-backend migrate ssl-init ssl-renew backup

DOMAIN ?= yourdomain.com
EMAIL  ?= admin@yourdomain.com

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-18s\033[0m %s\n",$$1,$$2}'

# ── Docker Compose ──────────────────────────────────────────────────────────

up: ## Start all services (detached)
	docker compose up -d

down: ## Stop all services
	docker compose down

build: ## Rebuild all images
	docker compose build --no-cache

restart: ## Restart backend + celery (after code changes)
	docker compose restart backend celery celery-beat

logs: ## Follow all service logs
	docker compose logs -f

logs-backend: ## Follow backend logs only
	docker compose logs -f backend

logs-celery: ## Follow celery logs only
	docker compose logs -f celery

# ── Database ────────────────────────────────────────────────────────────────

migrate: ## Run Alembic migrations inside the backend container
	docker compose exec backend python -m alembic upgrade head

shell-backend: ## Open a Python shell inside the backend container
	docker compose exec backend python

shell-db: ## Open psql inside the postgres container
	docker compose exec postgres psql -U contentflow contentflow

# ── SSL ─────────────────────────────────────────────────────────────────────

ssl-init: ## Obtain initial SSL certificate (run once, set DOMAIN and EMAIL)
	docker compose run --rm certbot certonly \
		--webroot -w /var/www/certbot \
		--non-interactive --agree-tos \
		--email $(EMAIL) \
		-d $(DOMAIN) -d www.$(DOMAIN)
	@echo "Certificate obtained. Update ssl_certificate paths in nginx-compose.conf, then: make restart-nginx"

ssl-renew: ## Force-renew SSL certificate
	docker compose run --rm certbot renew --force-renewal

restart-nginx: ## Reload nginx config without downtime
	docker compose exec nginx nginx -s reload

# ── Maintenance ─────────────────────────────────────────────────────────────

backup: ## Dump the database to ./backups/
	mkdir -p backups
	docker compose exec postgres pg_dump -U contentflow contentflow | gzip > backups/contentflow_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "Backup saved to backups/"

create-admin: ## Create admin user (EMAIL=a@b.com PASSWORD=secret)
	docker compose exec backend python create_admin.py --email $(EMAIL) --password $(PASSWORD)

ps: ## Show running containers
	docker compose ps

health: ## Check API health endpoint
	curl -sf http://localhost/api/health | python3 -m json.tool
