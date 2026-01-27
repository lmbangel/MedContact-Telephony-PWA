# Deploy MedContact Telephony PWA to Digital Ocean App Platform

## Overview
Configure automated deployments using:
- **Registry**: Digital Ocean Container Registry (DOCR)
- **CI/CD**: GitHub Actions
- **Platform**: Digital Ocean App Platform

## Architecture
```
GitHub Push → GitHub Actions → Build Docker Images → Push to DOCR → Deploy to DO App Platform
```

---

## Step 1: Create Digital Ocean Container Registry

1. Go to DO Console → Container Registry
2. Create a registry (e.g., `medcontact-registry`)
3. Note the registry URL: `registry.digitalocean.com/<your-registry-name>`

---

## Step 2: Create DO API Token for GitHub Actions

1. Go to DO Console → API → Generate New Token
2. Name: `github-actions-deploy`
3. Scopes: Read/Write access
4. Save the token securely (you'll add it to GitHub secrets)

---

## Step 3: Add GitHub Repository Secrets

Go to GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret Name | Value |
|-------------|-------|
| `DIGITALOCEAN_ACCESS_TOKEN` | Your DO API token |
| `REGISTRY_NAME` | Your registry name (e.g., `medcontact-registry`) |
| `APP_ID` | Your DO App ID (get after creating app in Step 6) |

---

## Step 4: Create GitHub Actions Workflow

**File**: `.github/workflows/deploy.yml`

```yaml
name: Build and Deploy to Digital Ocean

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: registry.digitalocean.com/${{ secrets.REGISTRY_NAME }}
  API_IMAGE: medcontact-api
  APP_IMAGE: medcontact-app

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}

      - name: Log in to DO Container Registry
        run: doctl registry login --expiry-seconds 1200

      - name: Build and push API image
        run: |
          docker build -t ${{ env.REGISTRY }}/${{ env.API_IMAGE }}:${{ github.sha }} \
                       -t ${{ env.REGISTRY }}/${{ env.API_IMAGE }}:latest \
                       ./api
          docker push ${{ env.REGISTRY }}/${{ env.API_IMAGE }}:${{ github.sha }}
          docker push ${{ env.REGISTRY }}/${{ env.API_IMAGE }}:latest

      - name: Build and push App image
        run: |
          docker build -t ${{ env.REGISTRY }}/${{ env.APP_IMAGE }}:${{ github.sha }} \
                       -t ${{ env.REGISTRY }}/${{ env.APP_IMAGE }}:latest \
                       ./app
          docker push ${{ env.REGISTRY }}/${{ env.APP_IMAGE }}:${{ github.sha }}
          docker push ${{ env.REGISTRY }}/${{ env.APP_IMAGE }}:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}

      - name: Deploy to App Platform
        run: doctl apps create-deployment ${{ secrets.APP_ID }} --wait
```

---

## Step 5: Update `.do/app.yaml` for Container Registry

Replace the current `.do/app.yaml` with:

```yaml
name: medcontact-telephony

services:
  # Go API Backend - from container registry
  - name: api
    image:
      registry_type: DOCR
      repository: medcontact-api
      tag: latest
    http_port: 8000
    instance_count: 1
    instance_size_slug: basic-xxs
    health_check:
      http_path: /api/health
      initial_delay_seconds: 10
      period_seconds: 30
      timeout_seconds: 5
      success_threshold: 1
      failure_threshold: 3
    routes:
      - path: /api
      - path: /twilio
    envs:
      - key: DB_HOST
        scope: RUN_TIME
        type: SECRET
      - key: DB_PORT
        scope: RUN_TIME
        value: "3306"
      - key: DB_NAME
        scope: RUN_TIME
        type: SECRET
      - key: DB_USER
        scope: RUN_TIME
        type: SECRET
      - key: DB_PASSWORD
        scope: RUN_TIME
        type: SECRET
      - key: JWT_SECRET
        scope: RUN_TIME
        type: SECRET
      - key: ALLOWED_ORIGINS
        scope: RUN_TIME
        value: ${APP_URL}
      - key: TWILIO_ACCOUNT_SID
        scope: RUN_TIME
        type: SECRET
      - key: TWILIO_AUTH_TOKEN
        scope: RUN_TIME
        type: SECRET
      - key: TWILIO_API_KEY_SID
        scope: RUN_TIME
        type: SECRET
      - key: TWILIO_API_KEY_SECRET
        scope: RUN_TIME
        type: SECRET
      - key: TWILIO_TWIML_APP_SID
        scope: RUN_TIME
        type: SECRET
      - key: TWILIO_PHONE_NUMBER
        scope: RUN_TIME
        type: SECRET
      - key: WEBHOOK_BASE_URL
        scope: RUN_TIME
        value: ${APP_URL}

  # Frontend - from container registry
  - name: frontend
    image:
      registry_type: DOCR
      repository: medcontact-app
      tag: latest
    http_port: 3000
    instance_count: 1
    instance_size_slug: basic-xxs
    routes:
      - path: /
```

---

## Step 6: Initial Setup Commands

### 6.1 Install and Configure doctl CLI

```bash
# Install doctl CLI
# macOS:
brew install doctl

# Linux (snap):
snap install doctl

# Linux (manual):
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-linux-amd64.tar.gz
tar xf doctl-1.104.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# Authenticate with Digital Ocean
doctl auth init
# (Enter your DO API token when prompted)
```

### 6.2 Create Container Registry

```bash
# Create container registry (starter tier is free, 500MB)
doctl registry create medcontact-registry --subscription-tier starter

# Verify registry was created
doctl registry get
```

### 6.3 Build and Push Initial Images (First Time Only)

```bash
# Log in to the registry
doctl registry login

# Build and push API image
docker build -t registry.digitalocean.com/medcontact-registry/medcontact-api:latest ./api
docker push registry.digitalocean.com/medcontact-registry/medcontact-api:latest

# Build and push App image
docker build -t registry.digitalocean.com/medcontact-registry/medcontact-app:latest ./app
docker push registry.digitalocean.com/medcontact-registry/medcontact-app:latest
```

### 6.4 Create the App on Digital Ocean

```bash
# Create the app from spec
doctl apps create --spec .do/app.yaml

# Get the App ID (save this as GitHub secret APP_ID)
doctl apps list

# Example output:
# ID                                      Spec Name              Default Ingress    Active Deployment ID    ...
# 12345678-1234-1234-1234-123456789abc    medcontact-telephony   app.ondigitalocean.app    ...
```

### 6.5 Set Environment Variables

After app creation, go to:
1. DO Console → Apps → medcontact-telephony → Settings
2. Click "App-Level Environment Variables"
3. Set all the SECRET values (DB credentials, Twilio keys, JWT secret, etc.)

---

## Step 7: Ongoing Deployments

After initial setup, the workflow is fully automated:

1. **Push code** to `main` branch
2. **GitHub Actions** triggers automatically:
   - Builds both Docker images
   - Tags with commit SHA and `latest`
   - Pushes to DO Container Registry
3. **App Platform** pulls new images and deploys
4. **Zero-downtime deployment** via rolling updates

### Manual Deployment (if needed)

```bash
# Trigger deployment manually
doctl apps create-deployment <your-app-id>

# Check deployment status
doctl apps list-deployments <your-app-id>

# View logs
doctl apps logs <your-app-id> --type=run
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `.github/workflows/deploy.yml` | Create | GitHub Actions CI/CD workflow |
| `.do/app.yaml` | Modify | Change to use DOCR images |

---

## Verification Checklist

After deployment, verify:

- [ ] GitHub Actions workflow completes successfully
- [ ] Images appear in DO Container Registry (Console → Container Registry)
- [ ] App Platform shows "Active" deployment status
- [ ] Frontend loads at `https://<your-app>.ondigitalocean.app/`
- [ ] API health check returns 200 at `/api/health`
- [ ] Login/register functionality works
- [ ] Twilio integration works (make a test call)

---

## Troubleshooting

### GitHub Actions fails to push to registry
- Verify `DIGITALOCEAN_ACCESS_TOKEN` has Read/Write permissions
- Verify `REGISTRY_NAME` matches exactly (case-sensitive)

### App Platform can't pull images
- Ensure registry is connected to your account: DO Console → Container Registry → Settings → DigitalOcean Container Registry Integration

### App crashes on startup
- Check logs: `doctl apps logs <app-id> --type=run`
- Verify all environment variables are set in App Platform
- Check health check endpoint is correct

### Database connection issues
- Verify DB_HOST, DB_USER, DB_PASSWORD are correct
- Ensure database allows connections from DO App Platform IPs

---

## Cost Estimate (Monthly)

| Service | Tier | Cost |
|---------|------|------|
| Container Registry | Starter (500MB) | Free |
| App Platform - API | basic-xxs | ~$5 |
| App Platform - Frontend | basic-xxs | ~$5 |
| **Total** | | **~$10/month** |

**Note**: You can also use the free tier for development, but it has limitations (sleep after inactivity, limited build minutes).

---

## Next Steps

1. Create the container registry on Digital Ocean
2. Generate API token and add GitHub secrets
3. Create the GitHub Actions workflow file
4. Update `.do/app.yaml` to use DOCR
5. Push initial images manually (first time)
6. Create the app on DO App Platform
7. Set environment variables in DO Console
8. Push to main branch to test the full pipeline
