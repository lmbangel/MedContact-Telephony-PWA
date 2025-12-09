.PHONY: help dev dev-backend dev-frontend build-frontend install clean-build docker-start docker-stop docker-restart docker-build docker-rebuild docker-logs docker-ps docker-clean

# Default target
help:
	@echo "OmniCall - Available Commands:"
	@echo ""
	@echo "LOCAL DEVELOPMENT (recommended):"
	@echo "  make dev              - Start both backend and frontend in dev mode"
	@echo "  make dev-backend      - Start backend only (http://localhost:3000)"
	@echo "  make dev-frontend     - Start frontend only (http://localhost:5173)"
	@echo "  make build-frontend   - Build frontend for production"
	@echo "  make install          - Install all dependencies"
	@echo "  make clean-build      - Clean build artifacts"
	@echo ""
	@echo "DOCKER DEVELOPMENT:"
	@echo "  make docker-start     - Start all services with Docker"
	@echo "  make docker-stop      - Stop all Docker services"
	@echo "  make docker-restart   - Restart all Docker services"
	@echo "  make docker-build     - Build Docker images"
	@echo "  make docker-rebuild   - Rebuild Docker images from scratch"
	@echo "  make docker-logs      - View Docker logs"
	@echo "  make docker-ps        - Show running containers"
	@echo "  make docker-clean     - Stop and remove all containers and volumes"
	@echo ""

# ============================================
# LOCAL DEVELOPMENT COMMANDS
# ============================================

# Install dependencies
install:
	@echo "Installing dependencies..."
	@echo "Installing frontend dependencies..."
	npm install
	@echo "Installing backend dependencies..."
	cd server && go mod download
	@echo "Dependencies installed!"

# Run both backend and frontend in development mode
dev:
	@echo "Starting OmniCall in development mode..."
	@echo "Backend will run on http://localhost:3000"
	@echo "Frontend will run on http://localhost:5173"
	@echo ""
	@echo "Press Ctrl+C to stop both services"
	@echo ""
	@make -j2 dev-backend dev-frontend

# Start backend only
dev-backend:
	@echo "Starting backend server..."
	@echo "Backend running on http://localhost:3000"
	cd server && go run main.go

# Start frontend only
dev-frontend:
	@echo "Starting frontend dev server..."
	@echo "Frontend running on http://localhost:5173"
	npm run dev

# Build frontend for production
build-frontend:
	@echo "Building frontend for production..."
	npm run build
	@echo "Frontend built to ./dist"

# Clean build artifacts
clean-build:
	@echo "Cleaning build artifacts..."
	rm -rf dist
	rm -rf node_modules/.vite
	@echo "Build artifacts cleaned!"

# ============================================
# DOCKER DEVELOPMENT COMMANDS
# ============================================

# Start all services with Docker
docker-start:
	@echo "Starting all services with Docker..."
	docker-compose up -d

# Stop all Docker services
docker-stop:
	@echo "Stopping all Docker services..."
	docker-compose down

# Restart all Docker services
docker-restart:
	@echo "Restarting all Docker services..."
	docker-compose restart

# Build Docker images
docker-build:
	@echo "Building Docker images..."
	docker-compose build

# Rebuild Docker images from scratch
docker-rebuild:
	@echo "Rebuilding Docker images from scratch..."
	docker-compose build --no-cache

# View Docker logs
docker-logs:
	@echo "Showing Docker logs (Ctrl+C to exit)..."
	docker-compose logs -f

# Show running containers
docker-ps:
	@echo "Running containers:"
	docker-compose ps

# Clean everything (Docker)
docker-clean:
	@echo "Stopping and removing all containers, networks, and volumes..."
	docker-compose down -v
	@echo "Docker cleanup done!"
