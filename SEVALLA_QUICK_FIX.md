# Quick Fix: Switch Sevalla from Nixpacks to Dockerfile

## What's Happening

Your deployment is failing because Sevalla is using **Nixpacks** (auto-detection) which only detects Node.js. Your app needs **both Node.js AND Go**, so you must use the Dockerfile.

## What You Saw
```
📦 Building docker image using nixpacks...
╔════════ Nixpacks v1.41.0 ═══════╗
║ setup      │ nodejs_18, npm-9_x ║  ← Only Node.js detected!
║─────────────────────────────────║
║ install    │ npm ci             ║
```

## How to Fix (2 Steps)

### Step 1: Change Build Method in Sevalla Dashboard

1. Go to your Sevalla dashboard
2. Navigate to your application
3. Click **Settings** (or **Build Settings**)
4. Look for **Build Method** or **Builder**
5. Change from **"Nixpacks"** to **"Dockerfile"**
6. Set **Dockerfile Path**: `./Dockerfile`
7. Save settings

### Step 2: Push Updated Code

```bash
# Commit the new configuration file
git add nixpacks.toml SEVALLA_DEPLOYMENT.md SEVALLA_QUICK_FIX.md
git commit -m "Configure Sevalla to use Dockerfile"
git push origin main
```

### Step 3: Redeploy

In Sevalla dashboard:
1. Click **"Deploy"** or **"Redeploy"**
2. Watch the build logs

## What You Should See (Correct Build)

```
[Stage 1: Build Frontend]
FROM node:20-alpine AS frontend-builder
...

[Stage 2: Build Backend]
FROM golang:alpine AS backend-builder
...

[Stage 3: Final Production Image]
FROM alpine:latest
...
```

## If It Still Uses Nixpacks

Some platforms cache the build method. Try:

1. **Delete the application** in Sevalla
2. **Create a new application** from the same GitHub repo
3. During setup, **select "Dockerfile"** as the build method from the start

## Environment Variables Checklist

Don't forget to set these in Sevalla:

- [ ] `DATABASE_PATH=/app/data/omnicall.db`
- [ ] `PORT=3000`
- [ ] `TWILIO_ACCOUNT_SID`
- [ ] `TWILIO_AUTH_TOKEN`
- [ ] `TWILIO_API_KEY_SID`
- [ ] `TWILIO_API_KEY_SECRET`
- [ ] `TWILIO_TWIML_APP_SID`
- [ ] `TWILIO_PHONE_NUMBER`
- [ ] `JWT_SECRET`

## Persistent Storage

Make sure to add persistent storage:
- **Mount Path**: `/app/data`
- **Size**: 1GB minimum

## Successful Deployment Output

You should see:
```
✅ Build completed successfully
✅ Image created
✅ Container started
✅ Health check passed
🚀 OmniCall Server running on http://localhost:3000
```

## Still Having Issues?

Check the build logs for:
1. "FROM node:20-alpine" - Frontend building
2. "FROM golang:alpine" - Backend building
3. "COPY --from=frontend-builder" - Files being copied
4. "COPY --from=backend-builder" - Binary being copied

If you don't see all of these, the Dockerfile is not being used.

---

**Next Steps**: See `SEVALLA_DEPLOYMENT.md` for complete deployment guide.
