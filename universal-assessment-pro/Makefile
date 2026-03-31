# Universal Assessment Pro — Development Makefile
# Usage: make <target>

.PHONY: help setup dev db-up db-down db-reset migrate seed build docker-up docker-down lint

# ─── Default target ───────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "Universal Assessment Pro"
	@echo "────────────────────────────────────────"
	@echo "  make setup      Full first-time setup (deps + DB + migrate + seed)"
	@echo "  make dev        Start dev server (requires DB to be running)"
	@echo "  make db-up      Start Postgres + Redis in Docker"
	@echo "  make db-down    Stop Postgres + Redis"
	@echo "  make db-reset   Drop & recreate database, re-run migrations + seed"
	@echo "  make migrate    Run pending Prisma migrations"
	@echo "  make seed       Run database seeder"
	@echo "  make build      Production build"
	@echo "  make docker-up  Start full stack (app + DB + Redis) in Docker"
	@echo "  make docker-down Stop full Docker stack"
	@echo "  make lint       Run ESLint + TypeScript checks"
	@echo ""

# ─── First-time setup ─────────────────────────────────────────────────────────

setup:
	@echo "📦 Installing dependencies..."
	npm ci
	@echo "🐳 Starting database services..."
	docker compose up -d postgres redis
	@echo "⏳ Waiting for Postgres to be ready..."
	@sleep 5
	@echo "🔄 Running migrations..."
	npx prisma migrate deploy
	@echo "🌱 Seeding database..."
	npx tsx prisma/seed.ts
	@echo ""
	@echo "✅ Setup complete! Run 'make dev' to start the development server."

# ─── Development ──────────────────────────────────────────────────────────────

dev:
	npm run dev

# ─── Database ─────────────────────────────────────────────────────────────────

db-up:
	docker compose up -d postgres redis
	@echo "✅ Postgres and Redis are running."

db-down:
	docker compose stop postgres redis

db-reset:
	@echo "⚠️  This will DROP and recreate the database!"
	docker compose stop postgres
	docker compose rm -f postgres
	docker volume rm $$(docker volume ls -q | grep postgres_data) 2>/dev/null || true
	docker compose up -d postgres
	@sleep 5
	npx prisma migrate deploy
	npx tsx prisma/seed.ts
	@echo "✅ Database reset complete."

migrate:
	npx prisma migrate deploy

seed:
	npx tsx prisma/seed.ts

# ─── Build ────────────────────────────────────────────────────────────────────

build:
	npm run build

# ─── Docker full stack ────────────────────────────────────────────────────────

docker-up:
	@if [ ! -f .env ]; then \
		echo "⚠️  .env file not found. Copying from .env.example..."; \
		cp .env.example .env; \
		echo "Please set AUTH_SECRET in .env before running!"; \
		exit 1; \
	fi
	docker compose up -d --build
	@echo "✅ Stack started at http://localhost:3000"

docker-down:
	docker compose down

# ─── Quality ──────────────────────────────────────────────────────────────────

lint:
	npx next lint
	npx tsc --noEmit
