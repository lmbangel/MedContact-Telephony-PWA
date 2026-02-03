# External Integrations

**Analysis Date:** 2026-02-03

## APIs & External Services

**Twilio Communications Platform:**
- Twilio Voice API - Inbound/outbound voice calls, call routing, and IVR
  - SDK: `github.com/twilio/twilio-go v1.28.7` (backend)
  - Frontend: Twilio Voice SDK (loaded via CDN script tag in HTML)
  - Auth: Credentials via environment variables
  - Key endpoint files:
    - Backend: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/main.go` (lines 1257-1721)
    - Frontend: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/app/src/js/services/TwilioService.js`

**Twilio Integration Details:**
- Account Management: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- API Credentials: `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`
- Application Configuration: `TWILIO_TWIML_APP_SID`
- Phone Number: `TWILIO_PHONE_NUMBER`
- Token Generation: POST `/api/twilio/token` - Generates access tokens for Voice SDK
- Voice Capabilities:
  - Outbound calls: `/twilio/outbound-voice` (handler)
  - Incoming calls: `/twilio/incoming-call` (handler)
  - Sequential routing: Dial callbacks, queue management
  - Call tracking: Call SID correlation and status updates

## Data Storage

**Primary Database:**
- MySQL 8.0+
  - Connection: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - Client: `github.com/go-sql-driver/mysql v1.9.3`
  - Dialect: InnoDB with utf8mb4 encoding
  - Database name: `medcontact`

**Code Generation:**
- sqlc - Generates type-safe Go database queries
  - Config: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/sqlc.yaml`
  - Schema: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/schema.sql`
  - Generated package: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/db/` (models.go, queries.sql.go)

**File Storage:**
- Local filesystem only
  - OTP logs: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/otp.log`
  - Call recordings: Stored via Twilio (URLs in transcriptions table)

**Caching:**
- None detected - All requests hit database directly

## Authentication & Identity

**Auth Provider:** Custom session-based authentication
- Implementation: Session tokens stored in MySQL
- Backend: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/main.go` (lines 326-504)
  - Register endpoint: POST `/api/auth/register`
  - Login endpoint: POST `/api/auth/login`
  - Logout endpoint: POST `/api/auth/logout`
  - Current user: GET `/api/auth/me`

**Password Security:**
- Algorithm: bcrypt (via `golang.org/x/crypto`)
- Cost factor: `bcrypt.DefaultCost`

**Session Management:**
- Cookie-based sessions with HTTP-only flag
- Session ID: 64-character hex string (generated from crypto/rand)
- Expiration: 7 days from creation
- Cookie name: `session_id`
- SameSite: Lax

**OTP Authentication:**
- One-time password for passwordless login
- OTP generation: 6-digit code
- Storage: MySQL `otp_codes` table
- Expiration: 5 minutes
- Delivery: Logged to console and `otp.log` file (SMTP not configured)
- Rate limiting: 3 attempts per 15 minutes
- Endpoints:
  - Send OTP: POST `/api/auth/otp/send`
  - Verify OTP: POST `/api/auth/otp/verify`

## Monitoring & Observability

**Error Tracking:**
- Not configured - No external service detected

**Logs:**
- Standard approach:
  - Backend: `log` package (Go standard library)
  - Console output with flags: `log.LstdFlags | log.Lshortfile`
  - OTP logging: File-based to `otp.log`
  - Frontend: Browser console (via `console.log`, `console.error`)
- Log locations:
  - Backend: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/server.log`
  - OTP: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/otp.log`

**Health Checks:**
- Backend health endpoint: GET `/api/health`
- Returns: `{"status": "ok"}`
- Docker healthcheck: HTTP request to `/api/health` every 30s

## CI/CD & Deployment

**Hosting Platform:**
- Docker containers (self-hosted or cloud-agnostic)
- Configuration: Docker Compose for orchestration
  - Development: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/docker-compose.yml`
  - Production: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/docker-compose.prod.yml`

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or other CI service found

**Deployment:**
- Manual deployment via Docker Compose or container orchestration
- Volumes: Data directory at `/data` for persistent storage
- Network: Bridge network `medcontact-local` for inter-container communication

## Environment Configuration

**Required Backend Environment Variables:**
- Database credentials: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Twilio credentials: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_TWIML_APP_SID`, `TWILIO_PHONE_NUMBER`
- Server: `PORT` (default: 8000)
- CORS: `ALLOWED_ORIGINS` (optional, comma-separated)
- Webhooks: `WEBHOOK_BASE_URL` (for Twilio callbacks)

**Required Frontend Environment Variables:**
- API URL: `VITE_API_URL` (default: http://localhost:8000)

**Secrets Location:**
- Development: `.env` file in project root or service directories
- Production: Environment variables provided by container orchestrator
- Secrets handling: `.env.example` file provided (`/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/.env.example`)

**Example .env.example:**
```
# From /home/lmbangel/.repository/projects/MedContact-Telephony-PWA/.env.example
# Twilio Configuration
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_API_KEY_SID=
TWILIO_API_KEY_SECRET=
TWILIO_TWIML_APP_SID=
TWILIO_PHONE_NUMBER=

# JWT Secret (generate a random string for security)
JWT_SECRET=
```

## Webhooks & Callbacks

**Incoming Webhooks from Twilio:**
- Incoming call handler: POST/GET `/twilio/incoming-call`
  - Form parameters: `From`, `To`, `CallSid`
  - Returns: TwiML response
  - Handler: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/main.go` (lines 1380-1424)

- Dial callback: POST/GET `/twilio/dial-callback`
  - Form parameters: `CallSid`, `DialCallStatus` (completed, no-answer, busy, failed, canceled)
  - Handles sequential agent routing
  - Handler: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/main.go` (lines 1485-1573)

- Queue wait handler: POST/GET `/twilio/queue-wait`
  - Returns: TwiML with hold music
  - Handler: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/main.go` (lines 1602-1614)

- Dequeue dial: POST/GET `/twilio/dequeue-dial`
  - Query parameter: `agent` (agent ID)
  - Dials available agent
  - Handler: `/home/lmbangel/.repository/projects/MedContact-Telephony-PWA/api/main.go` (lines 1617-1651)

**Outgoing Webhooks to Twilio:**
- Call updates via REST API: Twilio SDK calls `UpdateCall()` for call redirection
- Dequeue operations: Use REST API to redirect queued calls to agents

**Webhook Configuration:**
- Base URL: `WEBHOOK_BASE_URL` environment variable (default: http://localhost:8000)
- All webhooks registered in Chi router (lines 292-304 in main.go)

## External API Endpoints Used

**Twilio REST API Calls:**
- UpdateCall - Used to redirect queued calls to agents (line 1710)
  - Method: POST
  - Parameters: Call SID, TwiML URL, method

**Frontend API Calls:**
All API calls use Fetch API to backend endpoints:
- Auth: POST `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, GET `/api/auth/me`
- OTP: POST `/api/auth/otp/send`, `/api/auth/otp/verify`
- Companies: GET `/api/companies`, POST `/api/companies`
- Customers: GET `/api/customers`, GET `/api/customers/by-phone`, POST `/api/customers`
- Tasks: POST `/api/tasks`, GET `/api/tasks`, GET `/api/tasks/stats`
- Calls: POST `/api/calls`, PUT `/api/calls/{call_sid}`, GET `/api/calls/stats`, GET `/api/calls/customer/{customer_id}`
- Agent: GET `/api/agent/status`, POST `/api/agent/status`
- Twilio: GET `/api/twilio/token`

## Data Flow Diagram

**Incoming Call:**
1. PSTN → Twilio → POST `/twilio/incoming-call`
2. Backend finds available agents (ordered by idle time)
3. If available: Dial agent with 15s timeout
4. If no agents: Enqueue caller in hold queue
5. Agent answers or times out → `/twilio/dial-callback`
6. On callback: Try next agent or move to queue
7. When agent becomes available: `/twilio/dequeue-dial` → Dial agent

**Outgoing Call:**
1. Frontend → GET `/api/twilio/token` (get Twilio access token)
2. Twilio Device registers with token
3. Agent initiates call via Twilio SDK
4. Call routed via Twilio to customer
5. Agent/customer interaction
6. Frontend records call via POST `/api/calls`

---

*Integration audit: 2026-02-03*
