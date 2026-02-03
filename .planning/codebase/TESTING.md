# Testing Patterns

**Analysis Date:** 2026-02-03

## Test Framework

**Status:** Not Implemented

**Current State:**
- No test files found in codebase (`**/*.test.js`, `**/*.spec.js`, `**/*.test.go`)
- Frontend: No test runner configured (no Jest, Vitest, Cypress, etc. in dependencies)
- Backend: No testing dependencies in `go.mod` (testing would use Go's standard `testing` package)
- No test scripts in `package.json`

**Dependencies:**
- Frontend: Vite, Tailwind, autoprefixer - no testing framework
- Backend: chi, CORS, mysql, godotenv, twilio, bcrypt - no testing framework

## Testing Strategy (Current)

**Manual Testing Only:**
- Frontend: Browser manual testing via Vite dev server
- Backend: Manual API testing likely via curl/Postman or integration testing

**Run Commands (if tests existed):**
```bash
# Frontend (not implemented)
npm test           # Would run test suite (not configured)
npm run test:watch # Would run tests in watch mode (not configured)
npm run test:coverage # Would generate coverage report (not configured)

# Backend (not implemented)
go test ./...      # Would run all tests (no tests present)
go test -v ./...   # Verbose output (no tests present)
go test -cover ./... # Coverage report (no tests present)
```

## Test File Organization

**Pattern:** Not established (no test files exist)

**Proposed Pattern (if implemented):**
- Co-located: Test files adjacent to source files
- Naming: `[SourceFile].test.js` or `[SourceFile].spec.js`

Example structure:
```
app/src/
├── js/
│   ├── services/
│   │   ├── AuthService.js
│   │   ├── AuthService.test.js    (would be here)
│   │   ├── CustomerService.js
│   │   └── CustomerService.test.js
│   └── ui/
│       ├── ScreenController.js
│       └── ScreenController.test.js
└── main.js
```

Go test files would follow Go convention:
```
api/
├── main.go
├── main_test.go              (would be here)
└── db/
    ├── queries.sql.go
    └── queries.sql_test.go  (would be here)
```

## Test Structure (Hypothetical)

**Frontend (if Jest/Vitest used):**
```javascript
describe('AuthService', () => {
  describe('login', () => {
    it('should return success on valid credentials', async () => {
      // Setup
      // Execute
      // Assert
    });

    it('should return error on invalid password', async () => {
      // Setup
      // Execute
      // Assert
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when currentUser is set', () => {
      // Setup
      // Assert
    });
  });
});
```

**Backend (if using Go testing):**
```go
func TestRegister(t *testing.T) {
  // Setup
  db := setupTestDB(t)
  defer db.Close()

  server := &Server{db: db, queries: db.Queries()}

  // Test case
  req := RegisterRequest{
    Email:     "test@example.com",
    Password:  "password",
    Firstname: "John",
    Lastname:  "Doe",
    AgentID:   "agent123",
  }

  // Execute
  w := httptest.NewRecorder()
  r := httptest.NewRequest("POST", "/api/auth/register", jsonBody(req))

  server.register(w, r)

  // Assert
  assert.Equal(t, http.StatusOK, w.Code)
  assert.Contains(t, w.Body.String(), "success")
}
```

## Mocking

**Framework:** Not implemented (no mocking library in dependencies)

**Patterns (if implemented):**

JavaScript would use Jest or Vitest mocking:
```javascript
// Mock fetch API
global.fetch = jest.fn((url, options) => {
  if (url.includes('/api/auth/login')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        user: { id: 1, email: 'test@example.com' }
      })
    });
  }
  return Promise.resolve({ ok: false });
});
```

Go would use `httptest`:
```go
func TestLogin(t *testing.T) {
  // Create test request
  body := `{"email":"test@example.com","password":"password"}`
  req := httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(body))

  // Create test response recorder
  w := httptest.NewRecorder()

  // Call handler
  server.login(w, req)

  // Verify response
  assert.Equal(t, http.StatusOK, w.Code)
}
```

**What to Mock:**
- Fetch requests (external API calls)
- Database queries (database layer)
- Twilio SDK calls
- Time functions (for testing timeouts/intervals)

**What NOT to Mock:**
- Core business logic
- Utility functions (normalization, formatting)
- Error handling paths

## Fixtures and Factories

**Status:** Not implemented

**Pattern (if implemented):**

Test data factories for creating consistent test objects:

```javascript
// fixtures/userFixture.js
export function createTestUser(overrides = {}) {
  return {
    id: 1,
    email: 'test@example.com',
    firstname: 'John',
    lastname: 'Doe',
    agentId: 'agent123',
    companyId: 1,
    ...overrides
  };
}

export function createTestCustomer(overrides = {}) {
  return {
    id: 1,
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'customer@example.com',
    phone: '+27672966361',
    medical_aid_provider: 'Discovery',
    medical_plan: 'Essential',
    ...overrides
  };
}
```

Go factories would follow similar pattern:
```go
// test_fixtures.go
func createTestUser() db.User {
  return db.User{
    ID:        1,
    Email:     "test@example.com",
    Firstname: "John",
    Lastname:  "Doe",
    AgentID:   "agent123",
    CompanyID: 1,
  }
}
```

## Coverage

**Requirements:** None enforced (no coverage tools configured)

**Target (if implemented):** Would benefit from:
- Minimum 60% line coverage
- 80%+ coverage for critical paths (auth, payments, data access)
- 100% coverage for utility functions

**View Coverage (if tests existed):**
```bash
# Frontend
npm run test:coverage
# Would generate coverage/ directory with HTML report

# Backend
go test -cover ./...
# Shows coverage percentage per package

go tool cover -html=coverage.out
# Generates HTML report
```

## Test Types

**Unit Tests:**

Would test individual functions in isolation:
- Service method behavior
- Utility function logic
- State transitions in stores

Example scope for `AuthService.login()`:
- Valid credentials → returns success
- Invalid email → returns error
- Invalid password → returns error
- Network error → returns network error message

**Integration Tests:**

Would test component interactions:
- Authentication flow (login → store updates → UI changes)
- API call → database update → response verification
- Multiple services working together

Example: Customer lookup triggers on phone dial
```javascript
// Should:
// 1. Get customer by phone via CustomerService
// 2. Update CallStore with customer info
// 3. UI displays customer details
```

**E2E Tests:**

**Status:** Not implemented (no Cypress, Playwright, or WebDriver config)

Would test user workflows end-to-end:
- User registration → login → make call → end call
- Customer lookup → call recording → dashboard view
- Task creation and tracking

## Testing Gaps

**Critical Untested Areas:**

1. **Authentication Flow** (`app/src/js/services/AuthService.js`)
   - Login/register validation
   - Session management
   - OTP verification
   - Password hashing verification

2. **API Handlers** (`api/main.go`)
   - All HTTP endpoints (register, login, customer lookup, etc.)
   - Error responses and status codes
   - CORS handling
   - Request validation

3. **Database Operations** (`api/db/`)
   - Query execution
   - Connection handling
   - Transaction rollback

4. **Call State Management** (`app/src/js/services/CallStore.js`)
   - State transitions
   - Timer management
   - Event subscription/notification
   - Parent window messaging

5. **UI Controller** (`app/src/js/ui/ScreenController.js`)
   - Screen visibility toggling
   - DOM updates on state changes
   - Duration formatting

6. **Phone Number Utilities**
   - Normalization logic (multiple files)
   - Format validation
   - Edge cases (different input formats)

7. **Twilio Integration** (`app/src/js/services/TwilioService.js`)
   - Token generation
   - Call initiation
   - Error handling

8. **Dashboard Features** (`app/src/dashboard-home.js`)
   - Task management
   - Stats calculation
   - Customer management

## Recommendations for Testing Implementation

**Phase 1: Unit Tests**
- Create test files for core services (`AuthService`, `CustomerService`, `CallStore`)
- Add Jest/Vitest to frontend dependencies
- Cover authentication and state management

**Phase 2: Integration Tests**
- Test API endpoints with test database
- Mock external services (Twilio, email)
- Test service-to-service flows

**Phase 3: E2E Tests**
- Add Cypress for browser testing
- Test complete user journeys
- Verify UI updates on data changes

**Phase 4: Coverage Targets**
- Aim for 70%+ overall coverage
- 90%+ on critical paths (auth, data access)
- Maintain coverage as codebase grows

---

*Testing analysis: 2026-02-03*
