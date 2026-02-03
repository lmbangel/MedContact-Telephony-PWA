# Codebase Concerns

**Analysis Date:** 2026-02-03

## Security Issues

### Exposed Secrets in Version Control

**Issue:** Database credentials and API keys are committed in `.env` files.

**Files:**
- `api/.env` (contains Twilio API keys, database passwords, JWT secret)
- `.env` (root level)

**Impact:** Active Twilio account credentials and database passwords exposed. Any person with repository access can use these credentials to access production systems and modify telephony settings.

**Fix approach:**
1. Immediately revoke all exposed Twilio credentials and generate new ones
2. Change database password on Aiven instance
3. Add `.env` files to `.gitignore` before any future commits
4. Use environment-specific `.env.example` files with placeholder values only
5. Implement secrets management (GitHub Secrets, HashiCorp Vault, or similar)

### Hardcoded Fallback Credentials

**Issue:** Hardcoded phone numbers and fallback values in Twilio handlers.

**Files:** `api/main.go` (lines 1357-1358)

**Details:**
```go
fromNumber := "+13612664115" // Fallback to your number
toNumber := "+1234567890" // Fallback
```

**Impact:** Invalid fallback numbers may break call routing in production when environment variables aren't set.

**Fix approach:** Fail fast if required environment variables are missing rather than using hardcoded fallbacks. Log clear error messages.

### Weak Cookie Security Configuration

**Issue:** `Secure: false` flag in HTTP-only cookies in non-HTTPS environments.

**Files:** `api/main.go` (lines 414, 487)

**Details:**
```go
Secure: false, // Set to true in production with HTTPS
```

**Current state:** Code includes a TODO-style comment indicating manual change required for production.

**Impact:** Cookies transmitted over HTTP in development. Must be true in production.

**Fix approach:**
1. Use environment variable to set Secure flag based on environment
2. Force HTTPS in production configuration
3. Add pre-deployment validation

### Cross-Origin Message Posting Without Origin Verification

**Issue:** `postMessage` to parent window uses wildcard origin.

**Files:** `app/src/js/services/CallStore.js` (line 41)

**Details:**
```javascript
window.parent.postMessage({
  type: 'CALL_STATE_CHANGE',
  payload: { ...this.state }
}, '*');
```

**Impact:** Any window can receive sensitive call state information. Attackers can post messages from any origin.

**Fix approach:**
1. Replace `'*'` with explicit allowed origin (e.g., `window.location.origin`)
2. Add origin validation in message event listeners
3. Consider using structured messaging protocol with validation

### Inadequate Email Validation

**Issue:** Email validation uses simple string check instead of proper validation.

**Files:** `api/main.go` (line 2068)

**Details:**
```go
if req.Email == "" || !strings.Contains(req.Email, "@") {
```

**Impact:** Accepts invalid email formats. Spam-resistant OTP generation not enforced.

**Fix approach:** Use email validation library or regex pattern matching for RFC 5322 compliance.

---

## Tech Debt

### Monolithic API Handler File

**Issue:** All API logic in single 2,211-line file.

**Files:** `api/main.go`

**Impact:**
- Difficult to maintain and test individual handlers
- No separation of concerns (auth, customers, tasks, calls all mixed)
- Hard to locate specific functionality
- Code duplication in session/auth checks

**Fix approach:**
1. Create handler packages: `handlers/auth.go`, `handlers/customers.go`, `handlers/tasks.go`, `handlers/calls.go`
2. Extract middleware for session validation
3. Move helper functions to separate utility files
4. Implement dependency injection pattern for database access

### Session Validation Boilerplate

**Issue:** Every protected endpoint repeats identical session validation logic.

**Files:** `api/main.go` (lines 643-661, 864-880, 990-1006, 1024-1041, etc.)

**Details:** Each handler manually checks cookie, verifies session, checks expiration.

**Impact:**
- Code duplication increases bug risk
- Changes to session validation require updates in many places
- Difficult to add new security requirements

**Fix approach:**
1. Create middleware function `validateSession()` that extracts session from request
2. Use Go middleware chain pattern (chi provides this)
3. Pass session in request context
4. Reduce boilerplate by 50+ lines

### OTP Email Implementation for Development Only

**Issue:** OTP system logs to file instead of sending emails in development.

**Files:** `api/main.go` (lines 2007-2055)

**Details:**
```go
// For development: Log OTP to file instead of sending email
f, err := os.OpenFile("otp.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
```

**Impact:**
- Production OTP sending never tested in current setup
- No SMTP configuration in use
- File-based logging is unreliable (file permissions, disk space issues)

**Fix approach:**
1. Implement SMTP email sending with environment-based configuration
2. Use email service provider (SendGrid, AWS SES) instead of SMTP
3. Add unit tests that mock email sending
4. Validate email delivery in integration tests

### Frontend API URL Configuration

**Issue:** API_URL is empty string, relies on relative paths.

**Files:** `app/src/config.js` (line 2)

**Details:**
```javascript
export const API_URL = ''; // import.meta.env.VITE_API_URL || 'http://localhost:8000';
```

**Impact:**
- Only works when frontend and backend on same domain
- Cannot be deployed separately
- Environment variable commented out

**Fix approach:**
1. Use `import.meta.env.VITE_API_URL || 'http://localhost:8000'`
2. Create `.env.example` with `VITE_API_URL=http://localhost:8000`
3. Document environment setup in README

### Missing Error Boundaries in Frontend

**Issue:** Frontend services use try-catch but don't centralize error handling.

**Files:** `app/src/js/services/AuthService.js`, `TwilioService.js`, etc.

**Impact:**
- Inconsistent error reporting to UI
- No retry logic for transient failures
- Silent failures possible

**Fix approach:**
1. Create centralized error handler service
2. Implement retry logic with exponential backoff for network calls
3. Create error UI component for user feedback

---

## Database Concerns

### Missing Foreign Key Constraint

**Issue:** `call_notes.call_id` has no foreign key to `transcriptions.id`.

**Files:** `api/schema.sql` (line 138)

**Details:**
```sql
FOREIGN KEY (call_id) REFERENCES transcriptions(id) ON DELETE SET NULL
```

**Impact:** Orphaned call notes possible if transcription records deleted. Data integrity issues.

**Fix approach:** Verify foreign key is properly created. Add database integrity checks in deployment validation.

### N+1 Query Potential

**Issue:** Customer lookup performs multiple database queries per request.

**Files:** `api/main.go` (lines 688-730)

**Details:**
```go
// Try exact match first
customer, err := s.queries.GetCustomerByPhone(r.Context(), sql.NullString{...})
// Then try normalized number
customer, err = s.queries.GetCustomerByPhone(r.Context(), sql.NullString{...})
```

**Impact:** Multiple database round-trips for single customer lookup.

**Fix approach:**
1. Create database query that tries multiple phone formats in single query
2. Use UNION or OR clause in SQL
3. Cache normalized phone lookups

### Inefficient Queue Management

**Issue:** Call queue uses JSON string stored in `agents_tried` column.

**Files:** `api/schema.sql` (line 185), `api/main.go` (lines 1556-1556)

**Details:**
```go
agentsTriedJSON, _ := json.Marshal(agentsTried)
s.queries.UpdateQueueEntry(r.Context(), db.UpdateQueueEntryParams{
  AgentsTried: sql.NullString{String: string(agentsTriedJSON), Valid: true},
  ...
})
```

**Impact:**
- Query performance degraded as JSON strings grow
- Difficult to query which agents were tried
- Data type mismatch (JSON in string column)

**Fix approach:**
1. Create separate `queue_agent_attempts` table with proper foreign keys
2. Query and sort by single column `current_agent_index`
3. Archive completed queue entries

---

## Performance Issues

### Timer Not Cancelled on Component Cleanup

**Issue:** `durationTimer` in CallStore may not be cleaned up properly.

**Files:** `app/src/js/services/CallStore.js` (lines 199-204)

**Details:**
```javascript
startDurationTimer() {
  this.durationTimer = window.setInterval(() => {
    // ...
  }, 1000);
}
```

**Impact:**
- Memory leak if CallStore instance destroyed during active call
- Multiple timers accumulate if service reinitializes
- Browser memory usage grows over time

**Fix approach:**
1. Implement cleanup method called on destroy
2. Store all active timers in array
3. Clear all timers on disconnect

### Missing Connection Pool Configuration

**Issue:** Database connection pool not explicitly configured.

**Files:** `api/main.go` (line 199)

**Details:**
```go
database, err := sql.Open("mysql", dsn)
```

**Impact:**
- Default pool settings may not be optimal for load
- No connection limits set
- Database connection exhaustion possible under load

**Fix approach:**
1. Set `MaxOpenConns` and `MaxIdleConns`
2. Configure `ConnMaxLifetime`
3. Implement connection pool monitoring
4. Test under expected load

---

## Testing Gaps

### No Unit Tests Found

**Issue:** No test files in codebase.

**Files:** None exist for `api/main.go`, frontend services, etc.

**Impact:**
- Changes introduce regressions without detection
- Complex business logic (queue routing, task assignment) untested
- Integration issues discovered in production only

**Fix approach:**
1. Create `api/*_test.go` files for each handler
2. Write frontend tests using Jest/Vitest
3. Add integration tests for call flow
4. Aim for 70%+ coverage of critical paths

### No E2E Tests

**Issue:** Call routing workflow, OTP flow, and multi-step operations untested.

**Impact:** Authentication and call handling bugs only caught manually.

**Fix approach:**
1. Add E2E tests using Playwright or Cypress
2. Test: login → receive call → end call → verify recording
3. Test: OTP generation → verification → session creation

---

## Fragile Areas

### Call Routing Logic

**Issue:** Complex state management in incoming call handler with potential race conditions.

**Files:** `api/main.go` (lines 1380-1450+)

**Details:**
- Retrieves available agents
- Creates queue entry
- Updates agent status
- Multiple database writes without transactions

**Why fragile:**
- No transaction wrapping
- Concurrent calls could create duplicate queue entries
- If queue creation fails after agent status update, orphaned state

**Safe modification:**
1. Wrap queue creation in transaction
2. Add idempotency key to prevent duplicates
3. Add comprehensive error handling

### Token Refresh Mechanism

**Issue:** Token expiration handling in TwilioService lacks proper coordination.

**Files:** `app/src/js/services/TwilioService.js` (lines 113-117)

**Details:**
```javascript
this.device.on('tokenWillExpire', () => {
  console.log('Twilio token will expire soon, requesting refresh...');
  if (this.listeners.onTokenWillExpire) {
    this.listeners.onTokenWillExpire();
  }
});
```

**Why fragile:**
- No guarantee token is refreshed before expiration
- Multiple simultaneous token requests possible
- `isRefreshingToken` flag exists but not enforced

**Safe modification:**
1. Implement token refresh queue
2. Add timeout enforcement
3. Force disconnect if refresh fails

### Queue Entry State Transitions

**Issue:** Queue entry status (`waiting`, `routing`, `connected`) transitions lack validation.

**Files:** `api/main.go` (lines 1563-1568, 1583-1585)

**Impact:**
- Entry could transition from `routing` back to `waiting` unexpectedly
- Agent reassignment without cleaning up previous dial
- Calls dropped if status check fails

**Safe modification:**
1. Add state machine validation
2. Define valid transitions explicitly
3. Log state changes for debugging

---

## Scaling Concerns

### Single Company Assumption in Routing

**Issue:** Hardcoded `companyID := int32(1)` in incoming call handler.

**Files:** `api/main.go` (line 1394)

**Details:**
```go
// For now, use company_id = 1 as default
companyID := int32(1)
```

**Current capacity:** Works for single company only.

**Scaling path:**
1. Map Twilio phone number to company in database
2. Query company by phone number
3. Create `phone_number_routing` table with company mapping
4. Add lookup before agent assignment

### Webhook URL Configuration

**Issue:** Webhook base URL from environment, but ngrok-specific.

**Files:** `api/main.go` (line 1577), `api/.env` (line 23)

**Impact:**
- Development ngrok URL hard-coded in .env
- Manual URL updates needed for each deployment
- No automatic production webhook registration

**Scaling path:**
1. Use DNS-based webhook URLs (e.g., `api.company.com`)
2. Implement webhook registration service
3. Validate webhook URLs during deployment
4. Monitor webhook health

### Agent Status Polling

**Issue:** Agent availability checked on each incoming call.

**Files:** `api/main.go` (lines 1396-1398)

**Details:**
```go
agents, err := s.queries.GetAvailableAgentsByCompanyLongestIdle(r.Context(), companyID)
```

**Current capacity:** ~20-50 concurrent calls before latency impact.

**Scaling path:**
1. Cache agent availability (Redis)
2. Use message queue (RabbitMQ) for agent updates
3. Implement agent pool concept
4. Add load balancing

---

## Missing Features/Gaps

### No Call Recording

**Issue:** Transcriptions table exists but no recording integration.

**Files:** `api/schema.sql` (lines 94-124)

**Impact:** Cannot audit calls or generate transcripts.

**Fix approach:**
1. Implement Twilio call recording webhook
2. Store recording SID and URL in database
3. Add recording playback to UI
4. Implement transcription service integration

### No Rate Limiting on API Endpoints

**Issue:** Only OTP endpoint has rate limiting.

**Files:** `api/main.go` (lines 2085-2092)

**Impact:**
- Brute force attacks possible on login/register
- DOS vulnerability on customer lookup

**Fix approach:**
1. Implement rate limiter middleware (e.g., `tollbooth`)
2. Rate limit by IP and user ID separately
3. Store rate limit state in Redis
4. Return 429 with Retry-After header

### No Input Sanitization/XSS Prevention

**Issue:** Customer first_name, last_name stored without validation.

**Files:** `api/main.go` (lines 800-809)

**Impact:** Potential XSS if customer data displayed in frontend without escaping.

**Fix approach:**
1. Validate input length (max 100 chars)
2. Reject special characters or escape them
3. Use parameterized queries (already done, good)
4. Add frontend escaping layer

### No Audit Logging

**Issue:** Critical actions (auth, customer creation, task updates) not logged for audit.

**Files:** `api/main.go` (all handlers)

**Impact:** Cannot track who made what changes or detect suspicious activity.

**Fix approach:**
1. Create `audit_logs` table
2. Log: user ID, action, resource ID, timestamp, IP address
3. Archive audit logs quarterly
4. Implement audit log viewer in dashboard

---

## Documentation Gaps

### No API Documentation

**Issue:** API endpoints not documented (no OpenAPI/Swagger spec).

**Files:** None

**Impact:** Frontend developers must read Go code to understand APIs.

**Fix approach:**
1. Generate OpenAPI spec from code
2. Use `swaggo` library for auto-generation
3. Publish Swagger UI endpoint
4. Document auth requirements per endpoint

### No Database Migration Strategy

**Issue:** Schema.sql exists but no versioning or rollback mechanism.

**Files:** `api/migrations/` (exists but empty), `api/schema.sql`

**Impact:**
- Cannot evolve schema without downtime
- No rollback on failed deployments
- Team coordination issues on schema changes

**Fix approach:**
1. Implement `dbmate` or `flyway` migration tool
2. Create migration files with up/down scripts
3. Automate migrations on deployment
4. Test migrations in staging before production

---

## Environment-Specific Issues

### Production Readiness Checklist

**Missing items:**
- [ ] HTTPS enforced
- [ ] Secure cookie flags set
- [ ] Secrets stored in secure vault
- [ ] Database connection pooling configured
- [ ] Error logging (Sentry or similar)
- [ ] Performance monitoring (NewRelic or similar)
- [ ] CORS whitelist for production domains only
- [ ] Rate limiting on all endpoints
- [ ] Input validation and sanitization
- [ ] SQL injection testing
- [ ] CSRF protection
- [ ] Authentication token encryption

---

*Concerns audit: 2026-02-03*
