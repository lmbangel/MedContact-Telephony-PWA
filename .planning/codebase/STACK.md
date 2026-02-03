# Technology Stack

**Analysis Date:** 2026-02-03

## Languages

**Primary:**
- Go 1.24.0 - Backend API server (`/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/main.go`)
- JavaScript (ES6+) - Frontend application (`/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/app/src/`)
- HTML5 - Multi-page frontend (`/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/app/*.html`)
- SQL - MySQL database schema (`/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/schema.sql`)

**Secondary:**
- CSS/Tailwind - Styling (`/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/app/tailwind.config.js`)
- YAML - Configuration files

## Runtime

**Backend Environment:**
- Go 1.24.0
- MySQL 8.0+ (from docker-compose configuration)

**Frontend Environment:**
- Node.js v20+ (from README.md prerequisites)
- Browser runtime (Chromium/Firefox/Safari)

**Package Managers:**
- npm (Frontend) - npm modules in `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/app/package.json`
- Go modules (Backend) - go.mod in `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/go.mod`
- Lockfiles present: `package-lock.json`, `go.sum`

## Frameworks

**Core Backend:**
- Chi v5.2.3 - HTTP router and middleware framework (`github.com/go-chi/chi/v5`)
- Chi CORS v1.2.2 - CORS middleware (`github.com/go-chi/cors`)
- Go standard library - Core HTTP, JSON, database/sql

**Frontend:**
- Vite 5.0.12 - Build tool and dev server (`/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/app/vite.config.js`)
- Vanilla JavaScript - No JS framework (plain DOM manipulation)
- Twilio Voice SDK - Client library for telephony (loaded via script tag in HTML)

**Styling:**
- Tailwind CSS 3.4.1 - Utility-first CSS framework (`/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/app/tailwind.config.js`)
- PostCSS 8.4.33 - CSS processing
- Autoprefixer 10.4.17 - Vendor prefix automation

## Key Dependencies

**Backend (Critical):**
- `github.com/twilio/twilio-go v1.28.7` - Twilio REST API SDK for call management
- `github.com/go-sql-driver/mysql v1.9.3` - MySQL database driver
- `golang.org/x/crypto v0.45.0` - Password hashing (bcrypt)
- `github.com/golang-jwt/jwt/v5 v5.2.2` - JWT token handling (indirect)
- `github.com/joho/godotenv v1.5.1` - Environment variable loading

**Backend (Build/Dev):**
- `github.com/golang/mock v1.6.0` - Mock generation for testing (indirect)
- `filippo.io/edwards25519 v1.1.0` - Cryptographic library (indirect)

**Frontend (Build):**
- Vite (bundler)
- Tailwind CSS (styling processor)
- PostCSS (CSS preprocessor)

## Configuration

**Environment Variables (Backend):**
- `DB_HOST` - MySQL hostname
- `DB_PORT` - MySQL port
- `DB_NAME` - Database name (medcontact)
- `DB_USER` - MySQL user
- `DB_PASSWORD` - MySQL password
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `TWILIO_API_KEY_SID` - Twilio API key
- `TWILIO_API_KEY_SECRET` - Twilio API secret
- `TWILIO_TWIML_APP_SID` - Twilio TwiML application SID
- `TWILIO_PHONE_NUMBER` - Twilio phone number for outbound calls
- `JWT_SECRET` - Secret for JWT signing (mentioned but not actively used)
- `PORT` - Server port (default: 8000)
- `ALLOWED_ORIGINS` - CORS allowed origins (comma-separated)
- `WEBHOOK_BASE_URL` - Base URL for Twilio webhooks

**Environment Variables (Frontend):**
- `VITE_API_URL` - API backend URL (default: http://localhost:8000)

**Build Configuration:**
- `vite.config.js` - Vite build configuration (`/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/app/vite.config.js`)
  - Base: `/app/`
  - Output: `/dist`
  - Dev server port: 3000
  - Proxy: `/api` → http://localhost:8000
- `tailwind.config.js` - Tailwind configuration with custom colors (`/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/app/tailwind.config.js`)
- `postcss.config.js` - PostCSS configuration
- `sqlc.yaml` - SQL code generation configuration (`/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/sqlc.yaml`)
  - Engine: MySQL
  - Package: db

## Database

**Type:** MySQL 8.0+

**Schema Location:** `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/schema.sql`

**Primary Tables:**
- `companies` - Tenant organizations
- `users` - Agent/employee accounts
- `sessions` - Session tokens
- `otp_codes` - One-time password storage
- `customers` - Contact/patient records
- `transcriptions` - Call logs and recordings
- `call_notes` - Post-call notes
- `tasks` - Task management
- `agent_status` - Agent availability status
- `call_queue` - Call queue for sequential routing
- `call_outcomes` - Call classification categories
- `customer_premiums` - Insurance information

**Migrations:**
- Location: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/migrations/`
- Migration file: `001_add_user_fields.sql`

## Build & Deployment

**Container Platform:**
- Docker (Dockerfiles present for both services)
- Docker Compose (local and production configurations)

**Dockerfiles:**
- Backend: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/Dockerfile`
- Frontend: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/app/Dockerfile`

**Docker Compose:**
- Development: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/docker-compose.yml`
  - API service on port 8000
  - Frontend service on port 3000
  - MySQL database service
  - Health checks configured
- Production: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/docker-compose.prod.yml`

**Build Scripts (Makefile):**
- Location: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/Makefile`
- Commands: `make dev`, `make dev-api`, `make dev-app`, `make docker:up`, `make docker:down`

## Development Tools

**Frontend:**
- npm v10+ (Node package manager)
- Vite dev server (HMR enabled)

**Backend:**
- Go toolchain
- sqlc - SQL to Go code generator

**Code Generation:**
- sqlc generates strongly-typed database queries (`/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/db/`)

## Platform Requirements

**Development:**
- Node.js v20+
- Go v1.24.0
- MySQL 8.0+ (can run in Docker)
- Docker & Docker Compose (recommended)
- Make (optional, for convenience)

**Production:**
- Docker runtime
- MySQL 8.0+ database (external or container)
- HTTPS reverse proxy (nginx recommended)
- Twilio account with:
  - Account SID
  - Auth token
  - API key and secret
  - TwiML App configured
  - Phone number provisioned

---

*Stack analysis: 2026-02-03*
