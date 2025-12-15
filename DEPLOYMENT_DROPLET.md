# MedContact Deployment Guide for DigitalOcean (Subpath Routing)

This guide deploys the MedContact PWA with API and frontend on a single DigitalOcean droplet using Docker Compose, with subpath routing (not subdomains).

## Architecture

```
Domain: yourdomain.com
├─ https://yourdomain.com/app        → Vite Frontend (login, register, main app)
├─ https://yourdomain.com/api        → Go API Backend (REST endpoints, Twilio webhooks)
└─ https://yourdomain.com/dashboard  → Laravel Dashboard (future)

All traffic is reverse-proxied through nginx on ports 80/443.
```

## Prerequisites

- DigitalOcean droplet already provisioned (Ubuntu 22.04 or later)
- SSH access to the droplet
- Domain registered and DNS A record pointing to droplet IP
- Twilio account with API credentials

## Step 1: SSH into Droplet and Install Dependencies

```bash
# SSH to your droplet
ssh -i /path/to/key root@your_droplet_ip

# Update system
apt update && apt upgrade -y

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo bash get-docker.sh
sudo apt install -y docker-compose-plugin git

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add current user to docker group (optional, to avoid sudo)
sudo usermod -aG docker $USER
newgrp docker
```

## Step 2: Clone Repository and Setup

```bash
# Clone the repository
cd /srv
sudo git clone https://github.com/yourusername/medcontact.git medcontact
cd medcontact

# Create data directory for persistent storage
sudo mkdir -p /srv/data
sudo chmod 755 /srv/data

# Copy environment file
sudo cp .env.production .env
sudo nano .env  # Edit with your Twilio credentials and JWT secret
```

## Step 3: Generate SSL Certificates

### Option A: Using Certbot (Recommended)

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Create SSL directory
sudo mkdir -p docker/ssl

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates to docker/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem docker/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem docker/ssl/key.pem
sudo chown 1000:1000 docker/ssl/*

# Generate DH parameters (this takes ~2 min)
sudo openssl dhparam -out docker/dhparam.pem 2048

# Create auto-renewal cron job
echo "0 2 * * * certbot renew --quiet && cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /srv/medcontact/docker/ssl/cert.pem && cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /srv/medcontact/docker/ssl/key.pem && docker restart medcontact-proxy" | sudo crontab -
```

### Option B: Using mkcert (Self-Signed, for Testing Only)

```bash
# Install mkcert
wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert-v1.4.4-linux-amd64
sudo mv mkcert-v1.4.4-linux-amd64 /usr/local/bin/mkcert

# Create self-signed certificate
mkdir -p docker/ssl
mkcert -cert-file docker/ssl/cert.pem -key-file docker/ssl/key.pem yourdomain.com

# Generate DH parameters
openssl dhparam -out docker/dhparam.pem 2048
```

## Step 4: Update app/vite.config.js (Already Done ✓)

The `base: '/app/'` setting is already configured in vite.config.js. This ensures all assets load from the `/app` subpath.

## Step 5: Deploy with Docker Compose

```bash
cd /srv/medcontact

# Build and start all services
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Check service health
docker compose -f docker-compose.prod.yml ps
```

## Step 6: Verify Deployment

```bash
# Test frontend loads (you should see the login page)
curl -k https://yourdomain.com/app

# Test API health endpoint
curl -k https://yourdomain.com/api/health

# Check container logs for errors
docker compose -f docker-compose.prod.yml logs api
docker compose -f docker-compose.prod.yml logs frontend
docker compose -f docker-compose.prod.yml logs nginx-proxy
```

## Step 7: Update Twilio Webhooks

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to your **TwiML App**
3. Update the following URLs:
   - **Voice Request URL**: `https://yourdomain.com/api/twilio/incoming-call`
   - **Voice Status Callback**: `https://yourdomain.com/api/twilio/outbound-voice`
4. Save and test with an incoming call

## Step 8: Verify Twilio Webhooks

```bash
# Check API logs for incoming webhook calls
docker compose -f docker-compose.prod.yml logs api

# Look for POST requests to /twilio/incoming-call
```

## Backup & Persistence

The database is stored in `/srv/data` on the droplet's persistent disk. To backup:

```bash
# Manual backup
sudo cp -r /srv/data /srv/data-backup-$(date +%Y%m%d)

# Or setup daily cron backup
echo "0 3 * * * tar -czf /srv/backups/medcontact-\$(date +\%Y\%m\%d).tar.gz /srv/data" | sudo crontab -
```

## Updating Services

### Update Frontend or API Code

```bash
cd /srv/medcontact
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f
```

### Update Docker Images

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### 503 Bad Gateway

- Check if services are running: `docker compose -f docker-compose.prod.yml ps`
- Check service logs: `docker compose -f docker-compose.prod.yml logs api`
- Verify network connectivity: `docker network ls`

### Frontend Assets Return 404

- Ensure `base: '/app/'` is set in `app/vite.config.js`
- Rebuild frontend: `docker compose -f docker-compose.prod.yml up -d --build frontend`
- Check nginx config: `cat docker/nginx-proxy.conf`

### API Endpoints Return 404

- Frontend is correctly calling `/api/*` endpoints (relative paths)
- Nginx rewrites `/api/*` to `/*` before forwarding to Go service
- Check Go service is listening on port 8000: `docker compose -f docker-compose.prod.yml logs api`

### SSL Certificate Errors

- Verify cert files exist: `ls -la docker/ssl/`
- Check cert validity: `openssl x509 -in docker/ssl/cert.pem -text -noout`
- If expired, renew manually: `sudo certbot renew`

### Database Locked / SQLite Errors

- Ensure only one instance of the API is running
- Check file permissions: `ls -la /srv/data/`
- Restart the API service: `docker compose -f docker-compose.prod.yml restart api`

## Future: Adding Laravel Dashboard

When you're ready to add the `/dashboard` subpath (Laravel):

1. Create a `dashboard/Dockerfile` with PHP-FPM + Laravel
2. Build and add to `docker-compose.prod.yml` as a new service named `dashboard`
3. Uncomment the `/dashboard` location block in `docker/nginx-proxy.conf`
4. Rebuild and restart: `docker compose -f docker-compose.prod.yml up -d --build`

---

## Quick Command Reference

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f [service_name]

# Restart all services
docker compose -f docker-compose.prod.yml restart

# Stop all services
docker compose -f docker-compose.prod.yml down

# Stop and remove volumes
docker compose -f docker-compose.prod.yml down -v

# Rebuild a single service
docker compose -f docker-compose.prod.yml up -d --build [service_name]

# SSH into a running container
docker exec -it medcontact-api sh
docker exec -it medcontact-frontend sh
docker exec -it medcontact-proxy sh

# Check service health
docker compose -f docker-compose.prod.yml ps

# View disk usage
du -sh /srv/data
```

---

For support, check the main [README.md](../README.md) or review deployment logs in the droplet.
