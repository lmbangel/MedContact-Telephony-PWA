# Local Development Guide

This guide will help you run the OmniCall application locally for development.

## Prerequisites

- **Node.js** (v20 or higher) - [Download here](https://nodejs.org/)
- **Go** (v1.21 or higher) - [Download here](https://go.dev/dl/)
- **Make** (optional, for using Makefile commands)

## Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd MedContact-Telephony-PWA
```

### 2. Install Dependencies

```bash
make install
```

Or manually:

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server && go mod download && cd ..
```

### 3. Configure Environment Variables

Create a `.env` file in the `server/` directory:

```bash
cd server
cp .env.example .env  # If you have an example file
```

Or create a new `.env` file with:

```env
# Database
DATABASE_PATH=./omnicall.db

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_API_KEY_SID=your_api_key_sid
TWILIO_API_KEY_SECRET=your_api_key_secret
TWILIO_TWIML_APP_SID=your_twiml_app_sid
TWILIO_PHONE_NUMBER=your_phone_number

# JWT Secret (generate a random string)
JWT_SECRET=your_random_secret_key

# Server Port
PORT=3000
```

### 4. Run the Application

#### Option A: Run Everything (Recommended)

```bash
make dev
```

This starts both:
- Backend API server on `http://localhost:3000`
- Frontend dev server on `http://localhost:5173`

#### Option B: Run Services Separately

In separate terminal windows:

**Terminal 1 - Backend:**
```bash
make dev-backend
# Or directly: cd server && go run main.go
```

**Terminal 2 - Frontend:**
```bash
make dev-frontend
# Or directly: npm run dev
```

### 5. Access the Application

Open your browser to:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## Available Make Commands

### Local Development

```bash
make dev              # Start both backend and frontend
make dev-backend      # Start backend only
make dev-frontend     # Start frontend only
make install          # Install all dependencies
make build-frontend   # Build frontend for production
make clean-build      # Clean build artifacts
```

### Docker Development

```bash
make docker-start     # Start with Docker
make docker-stop      # Stop Docker services
make docker-restart   # Restart Docker services
make docker-build     # Build Docker images
make docker-rebuild   # Rebuild from scratch
make docker-logs      # View logs
make docker-ps        # Show running containers
make docker-clean     # Clean everything
```

## Project Structure

```
MedContact-Telephony-PWA/
├── src/                    # Frontend source code
│   ├── js/                # JavaScript modules
│   ├── styles/            # CSS styles
│   └── main.js           # Frontend entry point
├── server/                 # Backend source code
│   ├── db/               # Database queries
│   ├── main.go           # Backend entry point
│   ├── go.mod            # Go dependencies
│   └── .env              # Environment variables
├── dist/                   # Frontend build output (generated)
├── index.html             # Main page
├── login.html             # Login page
├── register.html          # Registration page
├── package.json           # Frontend dependencies
├── vite.config.js         # Vite configuration
├── Makefile              # Build commands
└── Dockerfile            # Production Docker image
```

## Development Workflow

### Making Frontend Changes

1. Edit files in `src/` directory
2. Vite will auto-reload the browser
3. View changes at http://localhost:5173

### Making Backend Changes

1. Edit files in `server/` directory
2. Stop the backend (Ctrl+C)
3. Restart with `make dev-backend`
4. Or use a hot-reload tool like [air](https://github.com/cosmtrek/air)

### Building for Production

```bash
make build-frontend
```

This creates optimized files in the `dist/` directory.

## Troubleshooting

### Port Already in Use

If port 3000 or 5173 is already in use:

**Backend:**
```bash
cd server
PORT=3001 go run main.go
```

**Frontend:**
Edit `vite.config.js` and change the port:
```js
server: {
  port: 5174  // Change this
}
```

### Database Issues

Delete the database and restart:
```bash
rm server/omnicall.db
make dev-backend
```

### Dependencies Not Installing

**Frontend:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Backend:**
```bash
cd server
rm -rf go.sum
go mod tidy
go mod download
```

### CORS Errors

The backend is configured to allow all origins in development. If you still get CORS errors, check:
1. Backend is running on port 3000
2. Frontend is making requests to `http://localhost:3000`

## Hot Reload Setup (Optional)

For automatic backend reloading during development:

```bash
# Install air
go install github.com/cosmtrek/air@latest

# Run backend with hot reload
cd server
air
```

## Testing

### Run Frontend Tests
```bash
npm test
```

### Run Backend Tests
```bash
cd server
go test ./...
```

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Company Endpoints

- `GET /api/companies` - Get all companies
- `POST /api/companies` - Create new company

### Customer Endpoints

- `GET /api/customers/by-phone?phone={number}` - Get customer by phone

### Twilio Endpoints

- `GET /api/twilio/token` - Get Twilio access token

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_PATH` | SQLite database file path | Yes |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | Yes |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | Yes |
| `TWILIO_API_KEY_SID` | Twilio API Key SID | Yes |
| `TWILIO_API_KEY_SECRET` | Twilio API Key Secret | Yes |
| `TWILIO_TWIML_APP_SID` | TwiML App SID | Yes |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number | Yes |
| `JWT_SECRET` | Secret for JWT tokens | Yes |
| `PORT` | Server port (default: 3000) | No |

## Need Help?

- Check the [main README](./README.md)
- Check the [Sevalla deployment guide](./SEVALLA_DEPLOYMENT.md)
- Open an issue on GitHub
