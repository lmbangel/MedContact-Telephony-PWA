# Deploying to Sevalla

This guide will help you deploy your OmniCall application to Sevalla.

## Prerequisites

- Sevalla account ([sign up here](https://sevalla.com))
- GitHub repository with your code
- Twilio account credentials

## Deployment Steps

### 1. Push Your Code to GitHub

Make sure all your changes are committed and pushed:

```bash
git add .
git commit -m "Configure for Sevalla deployment"
git push origin main
```

### 2. Create a New Application on Sevalla

1. Log in to your [Sevalla dashboard](https://sevalla.com)
2. Click "Create Application" or "New App"
3. Connect your GitHub repository
4. Select the repository: `MedContact-Telephony-PWA`
5. Select the branch: `main`

### 3. Configure Build Settings

Sevalla should auto-detect the Dockerfile. If it doesn't:

- **Build Method**: Dockerfile
- **Dockerfile Path**: `./Dockerfile`
- **Port**: 3000

### 4. Set Environment Variables

In your Sevalla application settings, add these environment variables:

```
DATABASE_PATH=/app/data/omnicall.db
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_API_KEY_SID=your_twilio_api_key_sid
TWILIO_API_KEY_SECRET=your_twilio_api_key_secret
TWILIO_TWIML_APP_SID=your_twiml_app_sid
TWILIO_PHONE_NUMBER=your_twilio_phone_number
JWT_SECRET=your_random_secret_key_here
PORT=3000
```

**Important**: Replace all `your_*` values with your actual credentials.

### 5. Configure Persistent Storage

Since your app uses SQLite, you need persistent storage:

1. In Sevalla dashboard, go to your application settings
2. Find "Persistent Disk" or "Volumes" section
3. Add a persistent volume:
   - **Mount Path**: `/app/data`
   - **Size**: 1GB (or as needed)

This ensures your database persists across deployments.

### 6. Deploy

Click "Deploy" in your Sevalla dashboard. Sevalla will:

1. Clone your repository
2. Build the frontend (Vite)
3. Build the Go backend
4. Create a production Docker image
5. Deploy and start your application

### 7. Access Your Application

Once deployed, Sevalla will provide you with a URL like:
```
https://your-app-name.sevalla.app
```

### 8. Update Twilio Webhook URLs

After deployment, update your Twilio webhooks to point to your Sevalla URL:

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to your TwiML App
3. Update webhook URLs:
   - **Voice Request URL**: `https://your-app-name.sevalla.app/twilio/incoming-call`
   - **Voice Status Callback URL**: `https://your-app-name.sevalla.app/twilio/outbound-voice`

## Troubleshooting

### Build Fails

- Check build logs in Sevalla dashboard
- Verify Dockerfile is at the root of your repository
- Ensure all dependencies are correctly specified in package.json and go.mod

### Application Won't Start

- Check application logs in Sevalla dashboard
- Verify all environment variables are set correctly
- Check that PORT is set to 3000

### Database Issues

- Ensure persistent storage is properly configured
- Check that DATABASE_PATH points to `/app/data/omnicall.db`
- Verify the data directory has write permissions

### API Calls Failing

- Verify environment variables are set correctly
- Check CORS settings if accessing from different domains
- Review application logs for specific errors

## Automatic Deployments

Sevalla supports automatic deployments. To enable:

1. Go to your application settings in Sevalla
2. Enable "Auto Deploy" for your main branch
3. Every push to `main` will automatically trigger a new deployment

## Monitoring

- **Health Check**: `https://your-app-name.sevalla.app/health`
- **Logs**: Available in Sevalla dashboard
- **Metrics**: Check Sevalla dashboard for CPU, memory, and request metrics

## Updating Your App

To deploy changes:

1. Make your code changes locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
3. Sevalla will automatically deploy (if auto-deploy is enabled) or manually trigger deployment in dashboard

## Cost Optimization

- Sevalla offers a free tier for testing
- Monitor your usage in the dashboard
- Scale down resources if not needed for development

---

For more information, visit the [Sevalla Documentation](https://docs.sevalla.com).
