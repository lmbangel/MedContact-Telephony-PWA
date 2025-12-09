# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy frontend source
COPY . .

# Build frontend
RUN npm run build

# Stage 2: Build Backend
FROM golang:alpine AS backend-builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache gcc musl-dev sqlite-dev git

# Copy go mod files
COPY server/go.mod server/go.sum ./
RUN go mod download

# Copy backend source
COPY server/ ./

# Build the Go application with CGO for SQLite
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o main .

# Stage 3: Final Production Image
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates sqlite-libs

WORKDIR /app

# Copy backend binary from builder
COPY --from=backend-builder /app/main .

# Copy frontend build from frontend-builder
COPY --from=frontend-builder /app/frontend/dist ./dist

# Copy server files needed at runtime
COPY server/schema.sql ./
COPY server/queries.sql ./

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Set environment variables
ENV DATABASE_PATH=/app/data/omnicall.db

# Run the application
CMD ["./main"]
