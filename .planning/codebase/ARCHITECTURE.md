# Architecture

**Analysis Date:** 2026-02-03

## Pattern Overview

**Overall:** Distributed architecture with separate API backend (Go/HTTP) and frontend SPA (Vanilla JavaScript/Vite), communicating via REST API with WebSocket for real-time Twilio Voice SDK integration.

**Key Characteristics:**
- Client-server separation with stateless REST API backend
- Single Page Application (SPA) frontend with service-based state management
- Twilio Voice SDK for call handling with backend token generation
- Database-driven with MySQL for all persistent data
- Session-based authentication with HTTP-only cookies
- Event-driven state management patterns on frontend

## Layers

**Backend (Go API):**
- Purpose: REST API server, database abstraction, Twilio integration
- Location: `/api/`
- Contains: HTTP request handlers, database queries (sqlc-generated), authentication logic, Twilio token generation
- Depends on: MySQL database, Twilio SDK, chi router
- Used by: Frontend applications via HTTP/REST

**Frontend - Presentation Layer:**
- Purpose: User interfaces and screen management
- Location: `/app/src/js/ui/`, `/app/src/*.js` (main.js, login.js, register.js, dashboard-*.js)
- Contains: HTML rendering logic, screen transitions, UI state management
- Depends on: Services layer for API calls and data
- Used by: Entry points (phone.html, index.html)

**Frontend - Services Layer:**
- Purpose: Business logic, API clients, domain-specific operations
- Location: `/app/src/js/services/`
- Contains:
  - `AuthService.js`: User authentication, login/register, session management
  - `TwilioService.js`: Twilio Device initialization, call handling, voice SDK integration
  - `CallStore.js`: Observable state management for call state
  - `CallTrackingService.js`: Recording call data, logging call events
  - `CustomerService.js`: Fetching customer data by phone/ID
  - `TaskService.js`: Task CRUD operations
- Depends on: config.js for API endpoints, backend API
- Used by: Presentation layer components

**Frontend - Configuration:**
- Purpose: Central API configuration and endpoint definitions
- Location: `/app/src/config.js`
- Contains: API_URL, API_ENDPOINTS constants
- Depends on: Nothing
- Used by: All services and pages

**Database Layer:**
- Purpose: Persistent data storage
- Location: `/api/db/` (MySQL database)
- Contains: User accounts, sessions, customers, companies, calls, tasks, OTP codes, agent status
- Depends on: Nothing
- Used by: Backend API via sqlc-generated queries

## Data Flow

**Authentication Flow:**

1. User submits login/register form on login.html or register.html
2. `AuthService.login()` or `AuthService.register()` makes POST to `/api/auth/login` or `/api/auth/register`
3. Backend validates credentials, hashes password with bcrypt, stores in MySQL
4. Backend creates session record and returns session_id cookie (HTTP-only)
5. AuthService checks authenticated status with `/api/auth/me`
6. Frontend redirects to phone.html (Vite entry point)

**Softphone Call Flow:**

1. App loads phone.html → main.js initializes TwilioService
2. main.js calls `twilioService.initialize(accessToken)` with token from `/api/twilio/token`
3. Backend generates Twilio JWT token with user's agentId as identity
4. TwilioService registers Twilio Device and listens for incoming calls
5. Incoming call triggers `onIncoming` listener → ScreenController shows incoming screen
6. User accepts call → call connects → duration timer starts
7. On call completion, TwilioService triggers `onDisconnected`
8. CallTrackingService logs call to backend via POST `/api/calls`
9. ScreenController shows idle screen

**Customer Information Flow (Incoming Call):**

1. Phone number received from incoming call (Twilio parameter `From`)
2. normalizePhoneNumber() converts to +27XXXXXXXXXX format
3. CustomerService.getCustomerByPhone() queries `/api/customers/by-phone?phone=...`
4. Backend returns customer record with medical info if exists
5. ScreenController.showIncomingScreen() displays customer name, medical aid info, custom lines
6. If customer not found, shows number as name

**Dashboard Data Flow:**

1. dashboard-home.js loads on user page visit
2. Fetches auth user with authService.init()
3. fetchCallStats() → GET `/api/calls/stats`
4. fetchTaskStats() → TaskService.getTaskStats() → GET `/api/tasks/stats`
5. fetchCompany() → GET `/api/companies`
6. updateCallStats() renders to dashboard elements
7. updateTaskStats() renders to dashboard elements

**State Management:**

CallStore maintains observable state:
```
{
  state: 'idle' | 'incoming' | 'outgoing' | 'active',
  caller: { name, number, location, line1, line2 },
  duration: number,
  startTime: timestamp
}
```

Components subscribe to CallStore.subscribe(listener) and receive updates when state changes. ScreenController listens and updates UI accordingly.

## Key Abstractions

**Server (Go):**
- Purpose: HTTP server with router, database connection management
- Examples: `/api/main.go` lines 32-35
- Pattern: Struct holds db connection and queries, methods are HTTP handlers

**Service Classes (Frontend):**
- Purpose: Encapsulate API client logic and domain operations
- Examples: `AuthService`, `TwilioService`, `CustomerService`
- Pattern: ES6 classes with singleton instances exported (e.g., `export const authService = new AuthService()`)

**Observable Store (CallStore):**
- Purpose: State management with pub-sub pattern
- Examples: `/app/src/js/services/CallStore.js`
- Pattern: Observable listeners set, notify() broadcasts state changes to all subscribers

**Request/Response Types (Go):**
- Purpose: Structured data validation and serialization
- Examples: `RegisterRequest`, `LoginRequest`, `AuthResponse`, `TaskStatsResponse`
- Pattern: Struct tags define JSON serialization

## Entry Points

**Backend Entry Point:**
- Location: `/api/main.go`
- Triggers: `go run main.go` or docker container start
- Responsibilities: Initialize database connection, setup chi router, register all route handlers, start HTTP server on port 8000

**Frontend Entry Points:**

**Phone/Softphone (Primary):**
- Location: `/app/phone.html`
- Triggers: After successful login, user navigates to `/app/phone.html`
- Responsibilities: Initialize Twilio Voice SDK, ScreenController, TwilioService, listen for calls, render call UI

**Login:**
- Location: `/app/index.html` (loads login.js or redirects to phone.html)
- Triggers: Direct navigation or unauthenticated access
- Responsibilities: Check auth status with authService.init(), show login/register forms, handle form submission

**Dashboard:**
- Location: Embedded iframe or direct page load to dashboard-home.js
- Triggers: User needs call/task statistics
- Responsibilities: Fetch and display call stats, task stats, agent status, customer information

## Error Handling

**Strategy:** Try-catch with user-friendly error messages and fallback states

**Patterns:**

**Backend:**
- All handlers use `respondError(w, statusCode, message)` utility function
- HTTP status codes indicate error severity (400 bad request, 401 unauthorized, 500 server error)
- JSON error responses with `{"detail": "message"}` structure
- Database errors caught and logged, return 500 with generic message

**Frontend:**
- Try-catch in async service methods (AuthService.login, CustomerService.getCustomerByPhone)
- Null/undefined checks for API responses before access
- Network errors handled with fallback (return null, show "not found")
- Validation errors shown in UI (login error message element)

## Cross-Cutting Concerns

**Logging:**
- Backend: `log` package with file output redirection (server.log, otp.log)
- Frontend: `console.log()` and `console.error()` to browser console

**Validation:**
- Backend: Field validation in register/login handlers (email, password, required fields)
- Frontend: HTML form validation (required attributes), email validation on input
- Phone number normalization in two places: `normalizePhoneNumber()` in main.js and CustomerService

**Authentication:**
- Backend: Session table with expiration timestamps, checked in getCurrentUser()
- Frontend: authService.init() called at app load, checks with `/api/auth/me`
- Authorization: Frontend-only (if not authenticated, redirect to login)

**CORS:**
- Backend: chi/cors middleware configured with allowedOrigins from environment
- Supports: localhost:3000, localhost:5173 (Vite), production origins from env var
- Credentials: true (allows cookies in requests)

---

*Architecture analysis: 2026-02-03*
