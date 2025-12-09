.PHONY: help dev dev-api dev-app install-api install-app build-app clean

# Default target
help:
	@echo "OmniCall - Available Commands:"
	@echo ""
	@echo "LOCAL DEVELOPMENT:"
	@echo "  make dev           - Start both API (8000) and App (3000)"
	@echo "  make dev-api       - Start API only on port 8000"
	@echo "  make dev-app       - Start frontend only on port 3000"
	@echo ""
	@echo "INSTALLATION:"
	@echo "  make install-api   - Install API dependencies (Go)"
	@echo "  make install-app   - Install App dependencies (npm)"
	@echo ""
	@echo "BUILD:"
	@echo "  make build-app     - Build frontend for production"
	@echo ""
	@echo "DOCKER:"
	@echo "  make docker-api    - Build and run API in Docker (port 8000)"
	@echo "  make docker-app    - Build and run App in Docker (port 3000)"
	@echo "  make docker-all    - Build and run both in Docker"
	@echo "  make docker-stop   - Stop all Docker containers"
	@echo ""
	@echo "CLEANUP:"
	@echo "  make clean         - Clean build artifacts"
	@echo ""

# Run both services
dev:
	@echo "Starting both API and App..."
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

# Docker commands
docker-api:
	@echo "Building and running API in Docker..."
	cd api && docker build -t omnicall-api . && docker run -p 8000:8000 --name omnicall-api-container omnicall-api

docker-app:
	@echo "Building and running App in Docker..."
	cd app && docker build -t omnicall-app . && docker run -p 3000:3000 --name omnicall-app-container omnicall-app

docker-all:
	@echo "Building and running both services in Docker..."
	@make -j2 docker-api docker-app

docker-stop:
	@echo "Stopping Docker containers..."
	docker stop omnicall-api-container omnicall-app-container 2>/dev/null || true
	docker rm omnicall-api-container omnicall-app-container 2>/dev/null || true

# Cleanup
clean:
	@echo "Cleaning build artifacts..."
	rm -rf app/dist app/node_modules
	@echo "Done!"
