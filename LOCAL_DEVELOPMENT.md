# Local Development Setup

This guide will help you set up and run MedContact locally so you can make changes without touching production.

## Prerequisites

- Docker and Docker Compose installed
- OR Go 1.21+ and Node.js 20+ for native development

## Quick Start (Docker - Recommended)

### 1. Initial Setup

```bash
make setup
```

This will:
- Create `.env` files from examples
- Install dependencies
- Prepare your local environment

### 2. Configure Environment

Edit the `.env` file in the root directory with your Twilio credentials:

```bash
TWILIO_ACCOUNT_SID=your_actual_account_sid
TWILIO_AUTH_TOKEN=your_actual_auth_token
TWILIO_API_KEY_SID=your_actual_api_key_sid
TWILIO_API_KEY_SECRET=your_actual_api_key_secret
TWILIO_TWIML_APP_SID=your_actual_twiml_app_sid
TWILIO_PHONE_NUMBER=your_actual_phone_number
JWT_SECRET=your_random_secret_key
```

### 3. Start Local Environment

```bash
make local-up
```

Your application will be available at:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:8000

### 4. View Logs

```bash
make local-logs
```

Press `Ctrl+C` to exit logs.

### 5. Stop Environment

```bash
make local-down
```

## Alternative: Native Development

If you prefer to run without Docker:

```bash
# Install dependencies
make install-api
make install-app

# Start both services (runs in parallel)
make dev

# OR start services individually
make dev-api   # API only on port 8000
make dev-app   # Frontend only on port 3000
```

## Common Commands

### Local Development (Docker)
- `make local-up` - Start local environment
- `make local-down` - Stop local environment
- `make local-restart` - Restart services
- `make local-logs` - View logs
- `make local-build` - Rebuild and restart

### Production (Docker)
- `make prod-up` - Start production environment (uses docker-compose.prod.yml)
- `make prod-down` - Stop production environment
- `make prod-logs` - View production logs
- `make prod-build` - Rebuild production images

### Other
- `make help` - See all available commands
- `make clean` - Clean build artifacts and Docker resources

## Development Workflow

1. **Start local environment**: `make local-up`
2. **Make your changes** to code in `api/` or `app/` directories
3. **Test locally** at http://localhost:3000
4. **Rebuild if needed**: `make local-build`
5. **Commit changes** to git
6. **Deploy to production** when ready

## Troubleshooting

### Port Already in Use
If ports 3000 or 8000 are in use:
```bash
# Stop local environment
make local-down

# Or find and kill the process using the port
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9
```

### Container Won't Start
```bash
# View logs for errors
make local-logs

# Rebuild from scratch
make local-down
make local-build
```

### Database Issues
The local database is stored in `./data/omnicall.db`. To reset:
```bash
make local-down
rm -rf ./data
make local-up
```

## File Structure

```
medContact/
├── api/                    # Go backend
│   ├── .env               # API environment variables (gitignored)
│   ├── Dockerfile
│   └── ...
├── app/                    # Vite frontend
│   ├── .env               # Frontend environment variables (gitignored)
│   ├── Dockerfile
│   └── ...
├── docker/                 # Production nginx configs
├── .env                    # Root environment variables (gitignored)
├── docker-compose.yml      # LOCAL development
├── docker-compose.prod.yml # PRODUCTION deployment
└── Makefile               # All commands
```

## Next Steps

- Make changes to your code
- Test locally before deploying
- Use git for version control
- Deploy to production only when ready

Happy coding!
