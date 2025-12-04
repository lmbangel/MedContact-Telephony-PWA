.PHONY: help start stop restart backend-start backend-stop backend-restart backend-logs frontend-start frontend-stop frontend-restart frontend-logs build rebuild clean logs ps

# Default target
help:
	@echo "OmniCall - Available Commands:"
	@echo ""
	@echo "  make start           - Start all services (backend + frontend)"
	@echo "  make stop            - Stop all services"
	@echo "  make restart         - Restart all services"
	@echo ""
	@echo "  make backend-start   - Start backend only"
	@echo "  make backend-stop    - Stop backend only"
	@echo "  make backend-restart - Restart backend only"
	@echo "  make backend-logs    - View backend logs"
	@echo ""
	@echo "  make frontend-start  - Start frontend only"
	@echo "  make frontend-stop   - Stop frontend only"
	@echo "  make frontend-restart- Restart frontend only"
	@echo "  make frontend-logs   - View frontend logs"
	@echo ""
	@echo "  make build           - Build all services"
	@echo "  make rebuild         - Rebuild all services from scratch"
	@echo "  make logs            - View all logs"
	@echo "  make ps              - Show running containers"
	@echo "  make clean           - Stop and remove all containers and volumes"
	@echo ""

# Start all services
start:
	@echo "Starting all services..."
	docker-compose up -d

# Stop all services
stop:
	@echo "Stopping all services..."
	docker-compose down

# Restart all services
restart:
	@echo "Restarting all services..."
	docker-compose restart

# Backend commands
backend-start:
	@echo "Starting backend..."
	docker-compose up -d backend

backend-stop:
	@echo "Stopping backend..."
	docker-compose stop backend

backend-restart:
	@echo "Restarting backend..."
	docker-compose restart backend

backend-logs:
	@echo "Showing backend logs (Ctrl+C to exit)..."
	docker-compose logs -f backend

# Frontend commands
frontend-start:
	@echo "Starting frontend..."
	docker-compose up -d frontend

frontend-stop:
	@echo "Stopping frontend..."
	docker-compose stop frontend

frontend-restart:
	@echo "Restarting frontend..."
	docker-compose restart frontend

frontend-logs:
	@echo "Showing frontend logs (Ctrl+C to exit)..."
	docker-compose logs -f frontend

# Build commands
build:
	@echo "Building all services..."
	docker-compose build

rebuild:
	@echo "Rebuilding all services from scratch..."
	docker-compose build --no-cache

# Logs and status
logs:
	@echo "Showing all logs (Ctrl+C to exit)..."
	docker-compose logs -f

ps:
	@echo "Running containers:"
	docker-compose ps

dev: 
	@echo "Running Dev:"
	docker-compose build --no-cache frontend && docker-compose up -d frontend

# Clean everything
clean:
	@echo "Stopping and removing all containers, networks, and volumes..."
	docker-compose down -v
	@echo "Done!"
