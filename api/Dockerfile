# Backend Dockerfile
FROM golang:alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache gcc musl-dev sqlite-dev git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o main .

# Production image
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates sqlite-libs

WORKDIR /app

# Copy binary and SQL files
COPY --from=builder /app/main .
COPY schema.sql queries.sql ./

# Create data directory
RUN mkdir -p /app/data

EXPOSE 8000

# Set default environment
ENV PORT=8000
ENV DATABASE_PATH=/app/data/omnicall.db

CMD ["/app/main"]
