# Sevalla Deployment Fix - Summary

## Problem Identified

Your deployment had **two issues**:

1. **Sevalla used Nixpacks** (auto-detection) instead of your Dockerfile
   - Only detected Node.js, missing the Go backend

2. **Start command used relative path** `./main` instead of absolute path
   - Container couldn't find the binary on startup

## Changes Made

### 1. **Dockerfile** (Updated)
- Changed CMD from `./main` to `/app/main` (absolute path)
- Verified binary builds correctly (13.5MB)

### 2. **Procfile** (New)
```
web: /app/main
```
Tells Sevalla exactly how to start your application.

### 3. **sevalla.yaml** (New)
```yaml
buildMethod: dockerfile
dockerfilePath: ./Dockerfile
port: 3000
healthCheck:
  path: /health
  port: 3000
run:
  command: /app/main
```
Explicit configuration for Sevalla platform.

### 4. **nixpacks.toml** (New)
Helps guide Sevalla if it still tries to auto-detect.

### 5. **Updated Documentation**
- `SEVALLA_QUICK_FIX.md` - Step-by-step fix
- `SEVALLA_DEPLOYMENT.md` - Complete deployment guide

## How to Deploy Now

### Step 1: Commit Changes
```bash
git add .
git commit -m "Fix Sevalla deployment: use Dockerfile with absolute path"
git push origin main
```

### Step 2: Configure Sevalla Dashboard

**CRITICAL**: Change build method to Dockerfile

1. Go to Sevalla Dashboard
2. Select your application
3. Go to **Settings** → **Build Configuration**
4. Change **Build Method**: `Nixpacks` → `Dockerfile`
5. Set **Dockerfile Path**: `./Dockerfile`
6. Set **Port**: `3000`
7. **Save** settings

### Step 3: Set Environment Variables

In Sevalla dashboard, add:

```env
DATABASE_PATH=/app/data/omnicall.db
PORT=3000
TWILIO_ACCOUNT_SID=your_actual_sid
TWILIO_AUTH_TOKEN=your_actual_token
TWILIO_API_KEY_SID=your_actual_key_sid
TWILIO_API_KEY_SECRET=your_actual_secret
TWILIO_TWIML_APP_SID=your_actual_twiml_sid
TWILIO_PHONE_NUMBER=your_actual_number
JWT_SECRET=your_random_secret_key
```

### Step 4: Configure Persistent Storage

1. In Sevalla dashboard → **Storage** or **Volumes**
2. Add persistent volume:
   - **Mount Path**: `/app/data`
   - **Size**: 1GB

### Step 5: Deploy

Click **Deploy** or **Redeploy** in Sevalla dashboard.

## Expected Build Output (Correct)

```
[Stage 1: Build Frontend]
FROM node:20-alpine AS frontend-builder
✓ npm ci
✓ npm run build

[Stage 2: Build Backend]
FROM golang:alpine AS backend-builder
✓ Installing gcc, sqlite-dev
✓ go mod download
✓ Building Go binary

[Stage 3: Final Production Image]
FROM alpine:latest
✓ Copying frontend dist/
✓ Copying backend binary
✓ Image created successfully
```

## Expected Startup Output (Correct)

```
✅ Docker image pushed successfully
⏩ Deploying Web process...
🚀 OmniCall Server running on http://localhost:3000
📊 Health check: http://localhost:3000/health
✅ Health check passed
```

## If It Still Fails

### Check 1: Build Method
Verify Sevalla is using **Dockerfile**, not Nixpacks.

### Check 2: Logs
In Sevalla dashboard, check build logs for:
- "Stage 1: Build Frontend"
- "Stage 2: Build Backend"
- "Stage 3: Final Production Image"

### Check 3: Start Command
Verify Sevalla is using `/app/main` or reading from `Procfile`.

### Check 4: Environment Variables
Ensure all required variables are set (especially Twilio credentials).

## Testing Locally

To test the exact same setup locally:

```bash
# Build
docker build -t omnicall-test .

# Run
docker run -p 3000:3000 \
  -e DATABASE_PATH=/app/data/omnicall.db \
  -e PORT=3000 \
  omnicall-test

# Test
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

## Files Changed

- ✅ `Dockerfile` - Fixed CMD path
- ✅ `Procfile` - New start command
- ✅ `sevalla.yaml` - New platform config
- ✅ `nixpacks.toml` - New build hint
- ✅ `SEVALLA_QUICK_FIX.md` - Updated guide
- ✅ `SEVALLA_DEPLOYMENT.md` - Updated guide

## Next Steps After Deployment

1. Access your app at `https://your-app-name.sevalla.app`
2. Test health check: `https://your-app-name.sevalla.app/health`
3. Update Twilio webhooks to point to your Sevalla URL
4. Test making a call

---

**Need help?** Check `SEVALLA_QUICK_FIX.md` for detailed troubleshooting.
