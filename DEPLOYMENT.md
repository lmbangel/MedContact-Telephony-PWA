# Deployment Guide

This guide covers deploying the frontend and backend as **separate applications** on Sevalla.

## Project Structure

```
├── app/              # Frontend (Vite + JS) - Port 3000
│   ├── src/
│   ├── index.html
│   ├── Dockerfile
│   └── nginx.conf
│
├── api/              # Backend (Go API) - Port 8000
│   ├── main.go
│   ├── Dockerfile
│   └── db/
│
├── Makefile          # Development commands
└── README.md
```

## Deploy to Sevalla (2 Separate Apps)

### Step 1: Deploy Backend API First

#### 1.1 Create Backend App on Sevalla

1. Log in to [Sevalla Dashboard](https://sevalla.com)
2. Click **"Create Application"**
3. Connect your GitHub repository
4. Select repository and branch: `main`
5. **Name**: `omnicall-api` (or your choice)

#### 1.2 Configure Backend Build

- **Build Method**: `Dockerfile`
- **Dockerfile Path**: `./api/Dockerfile`
- **Port**: `8000`
- **Root Directory**: `api/`

#### 1.3 Set Backend Environment Variables

```env
PORT=8000
DATABASE_PATH=/app/data/omnicall.db
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_API_KEY_SID=your_api_key_sid
TWILIO_API_KEY_SECRET=your_api_key_secret
TWILIO_TWIML_APP_SID=your_twiml_app_sid
TWILIO_PHONE_NUMBER=your_phone_number
JWT_SECRET=your_random_secret_key
```

#### 1.4 Configure Persistent Storage (Important!)

- **Mount Path**: `/app/data`
- **Size**: 1GB (minimum)

#### 1.5 Deploy Backend

Click **"Deploy"** and wait for it to complete.

Your API will be available at: `https://omnicall-api.sevalla.app`

---

### Step 2: Deploy Frontend App

#### 2.1 Create Frontend App on Sevalla

1. In Sevalla Dashboard, click **"Create Application"** again
2. Select the **same GitHub repository**
3. Select branch: `main`
4. **Name**: `omnicall-app` (or your choice)

#### 2.2 Configure Frontend Build

- **Build Method**: `Dockerfile`
- **Dockerfile Path**: `./app/Dockerfile`
- **Port**: `3000`
- **Root Directory**: `app/`

#### 2.3 Set Frontend Environment Variable

**IMPORTANT**: Set API URL to your deployed backend:

```env
VITE_API_URL=https://omnicall-api.sevalla.app
```

Replace `omnicall-api.sevalla.app` with your actual backend URL from Step 1.

#### 2.4 Deploy Frontend

Click **"Deploy"** and wait for it to complete.

Your frontend will be available at: `https://omnicall-app.sevalla.app`

---

### Step 3: Update Twilio Webhooks

After both apps are deployed, update your Twilio webhooks:

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to your TwiML App
3. Update webhook URLs to your **backend** URL:
   - **Voice Request URL**: `https://omnicall-api.sevalla.app/twilio/incoming-call`
   - **Voice Status Callback**: `https://omnicall-api.sevalla.app/twilio/outbound-voice`

---

## Deployment Checklist

### Backend (API)
- [ ] Dockerfile build method selected
- [ ] Port set to 8000
- [ ] All environment variables configured
- [ ] Persistent storage mounted at `/app/data`
- [ ] Deployment successful
- [ ] Health check passes: `https://your-api.sevalla.app/health`

### Frontend (App)
- [ ] Dockerfile build method selected
- [ ] Port set to 3000
- [ ] `VITE_API_URL` points to backend
- [ ] Deployment successful
- [ ] App loads in browser

### Twilio
- [ ] Webhooks updated to backend URL
- [ ] Incoming calls working
- [ ] Outgoing calls working

---

## Troubleshooting

### Backend Issues

**Health check failing:**
- Verify environment variables are set
- Check persistent storage is mounted
- View deployment logs in Sevalla dashboard

**Database errors:**
- Ensure `DATABASE_PATH=/app/data/omnicall.db`
- Verify persistent storage is configured
- Check write permissions on `/app/data`

### Frontend Issues

**API calls failing:**
- Verify `VITE_API_URL` is set correctly
- Check backend is deployed and running
- Open browser console to see exact errors

**Blank page:**
- Check deployment logs for build errors
- Verify all files built successfully
- Check nginx is serving files correctly

### CORS Errors

If you see CORS errors:
1. Backend is configured to allow all origins (`*`)
2. Check `VITE_API_URL` matches your backend URL exactly
3. Ensure no trailing slashes in URLs

---

## Updating Your Apps

### Update Backend

```bash
# Make changes to api/ folder
git add api/
git commit -m "Update backend"
git push origin main
```

Sevalla will auto-deploy if enabled, or manually trigger in dashboard.

### Update Frontend

```bash
# Make changes to app/ folder
git add app/
git commit -m "Update frontend"
git push origin main
```

---

## Cost Optimization

- Both apps can run on Sevalla's free tier for testing
- Monitor usage in Sevalla dashboard
- Scale down if not actively developing

---

## Alternative: Deploy Frontend to Vercel/Netlify

If you prefer, deploy:
- **Frontend**: Vercel/Netlify (FREE, faster, easier)
- **Backend**: Sevalla/Railway/Render

### Deploy Frontend to Vercel

1. Go to [Vercel](https://vercel.com)
2. Import your GitHub repository
3. **Root Directory**: `app/`
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`
6. **Environment Variable**: `VITE_API_URL=https://your-api.sevalla.app`
7. Deploy!

Frontend will be at: `https://your-app.vercel.app`

---

For local development, see the main [README.md](./README.md).
