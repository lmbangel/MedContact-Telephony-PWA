.PHONY: help setup dev dev-api dev-app install-api install-app build-app \
        local-up local-down local-restart local-logs local-build \
        prod-up prod-down prod-restart prod-logs prod-build \
        migrate-up migrate-down migrate-status \
        clean

# Default target
help:
	@echo "MedContact - Available Commands:"
	@echo ""
	@echo "SETUP:"
	@echo "  make setup         - Initial setup: copy .env files and install dependencies"
	@echo ""
	@echo "LOCAL DEVELOPMENT (Docker Compose):"
	@echo "  make local-up      - Start local environment with docker-compose"
	@echo "  make local-down    - Stop local environment"
	@echo "  make local-restart - Restart local environment"
	@echo "  make local-logs    - View logs from local containers"
	@echo "  make local-build   - Rebuild and start local environment"
	@echo ""
	@echo "LOCAL DEVELOPMENT (Native):"
	@echo "  make dev           - Start both API (8000) and App (3000) natively"
	@echo "  make dev-api       - Start API only on port 8000"
	@echo "  make dev-app       - Start frontend only on port 3000"
	@echo ""
	@echo "PRODUCTION (Docker Compose):"
	@echo "  make prod-up       - Start production environment"
	@echo "  make prod-down     - Stop production environment"
	@echo "  make prod-restart  - Restart production environment"
	@echo "  make prod-logs     - View logs from production containers"
	@echo "  make prod-build    - Rebuild and start production environment"
	@echo ""
	@echo "INSTALLATION:"
	@echo "  make install-api   - Install API dependencies (Go)"
	@echo "  make install-app   - Install App dependencies (npm)"
	@echo ""
	@echo "BUILD:"
	@echo "  make build-app     - Build frontend for production"
	@echo ""
	@echo "DATABASE MIGRATIONS:"
	@echo "  make migrate-up    - Run all pending migrations"
	@echo "  make migrate-down  - Rollback the last migration"
	@echo "  make migrate-status- Show migration status"
	@echo ""
	@echo "CLEANUP:"
	@echo "  make clean         - Clean build artifacts and Docker resources"
	@echo ""

# Setup - First time installation
setup:
	@echo "Setting up MedContact for local development..."
	@if [ ! -f .env ]; then \
		echo "Creating .env file from .env.example..."; \
		cp .env.example .env; \
		echo "⚠️  Please edit .env with your Twilio credentials"; \
	else \
		echo "✓ .env file already exists"; \
	fi
	@if [ ! -f api/.env ]; then \
		echo "Creating api/.env file..."; \
		cp api/.env.example api/.env; \
	else \
		echo "✓ api/.env file already exists"; \
	fi
	@if [ ! -f app/.env ]; then \
		echo "Creating app/.env file..."; \
		cp app/.env.example app/.env; \
	else \
		echo "✓ app/.env file already exists"; \
	fi
	@echo ""
	@echo "Installing dependencies..."
	@make install-api install-app
	@echo ""
	@echo "✓ Setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "1. Edit .env file with your Twilio credentials"
	@echo "2. Run 'make local-up' to start with Docker"
	@echo "   OR 'make dev' to run natively"
	@echo ""

# Local Docker Compose Commands
local-up:
	@echo "Starting local development environment..."
	@if [ ! -f .env ]; then \
		echo "⚠️  .env file not found. Run 'make setup' first."; \
		exit 1; \
	fi
	docker-compose up -d
	@echo ""
	@echo "✓ Local environment started!"
	@echo "  API: http://localhost:8000"
	@echo "  App: http://localhost:3000"
	@echo ""
	@echo "View logs: make local-logs"
	@echo "Stop: make local-down"

local-down:
	@echo "Stopping local development environment..."
	docker-compose down
	@echo "✓ Local environment stopped"

local-restart:
	@echo "Restarting local development environment..."
	docker-compose restart
	@echo "✓ Local environment restarted"

local-logs:
	docker-compose logs -f

local-build:
	@echo "Rebuilding and starting local environment..."
	docker-compose up -d --build
	@echo "✓ Local environment rebuilt and started"

# Production Docker Compose Commands
prod-up:
	@echo "Starting production environment..."
	@if [ ! -f .env ]; then \
		echo "⚠️  .env file not found. Run 'make setup' first."; \
		exit 1; \
	fi
	docker-compose -f docker-compose.prod.yml up -d
	@echo ""
	@echo "✓ Production environment started!"
	@echo ""
	@echo "View logs: make prod-logs"
	@echo "Stop: make prod-down"

prod-down:
	@echo "Stopping production environment..."
	docker-compose -f docker-compose.prod.yml down
	@echo "✓ Production environment stopped"

prod-restart:
	@echo "Restarting production environment..."
	docker-compose -f docker-compose.prod.yml restart
	@echo "✓ Production environment restarted"

prod-logs:
	docker-compose -f docker-compose.prod.yml logs -f

prod-build:
	@echo "Rebuilding and starting production environment..."
	docker-compose -f docker-compose.prod.yml up -d --build
	@echo "✓ Production environment rebuilt and started"

# Run both services natively
dev:
	@echo "Starting both API and App natively..."
	@echo "API: http://localhost:8000"
	@echo "App: http://localhost:3000"
	@echo ""
	@make -j2 dev-api dev-app

# API (Backend)
dev-api:
	@echo "Starting API server on port 8000..."
	cd api && go run main.go

install-api:
	@echo "Installing API dependencies..."
	cd api && go mod download

# App (Frontend)
dev-app:
	@echo "Starting App dev server on port 3000..."
	cd app && npm run dev

install-app:
	@echo "Installing App dependencies..."
	cd app && npm install

build-app:
	@echo "Building App for production..."
	cd app && npm run build

# Database Migrations (using goose)
# Loads DB credentials from api/.env file
migrate-up:
	@echo "Running database migrations..."
	@cd api && . ./.env && goose -dir migrations mysql "$${DB_USER}:$${DB_PASSWORD}@tcp($${DB_HOST}:$${DB_PORT})/$${DB_NAME}" up

migrate-down:
	@echo "Rolling back last migration..."
	@cd api && . ./.env && goose -dir migrations mysql "$${DB_USER}:$${DB_PASSWORD}@tcp($${DB_HOST}:$${DB_PORT})/$${DB_NAME}" down

migrate-status:
	@echo "Checking migration status..."
	@cd api && . ./.env && goose -dir migrations mysql "$${DB_USER}:$${DB_PASSWORD}@tcp($${DB_HOST}:$${DB_PORT})/$${DB_NAME}" status

# Cleanup
clean:
	@echo "Cleaning build artifacts and Docker resources..."
	rm -rf app/dist app/node_modules
	docker-compose down -v 2>/dev/null || true
	docker-compose -f docker-compose.prod.yml down -v 2>/dev/null || true
	@echo "✓ Cleanup complete!"
