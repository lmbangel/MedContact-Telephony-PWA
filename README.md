# OmniCall - Telephony PWA

A modern telephony Progressive Web App with Twilio integration, featuring a clean separation between frontend and backend.

## Architecture

- **Frontend** (`app/`): Vite + Vanilla JavaScript - Port 3000
- **Backend** (`api/`): Go API with SQLite - Port 8000

## Quick Start

### Prerequisites

- **Node.js** (v20+) - [Download](https://nodejs.org/)
- **Go** (v1.21+) - [Download](https://go.dev/dl/)
- **Make** (optional, for convenience commands)

### Installation

\`\`\`bash
# Install frontend dependencies
cd app && npm install && cd ..

# Install backend dependencies
cd api && go mod download && cd ..
\`\`\`

### Development

**Run both services:**
\`\`\`bash
make dev
\`\`\`

**Or run separately:**

Terminal 1 (Backend):
\`\`\`bash
make dev-api
# or: cd api && go run main.go
\`\`\`

Terminal 2 (Frontend):
\`\`\`bash
make dev-app
# or: cd app && npm run dev
\`\`\`

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Health Check: http://localhost:8000/health

For full documentation, see [DEPLOYMENT.md](./DEPLOYMENT.md).
