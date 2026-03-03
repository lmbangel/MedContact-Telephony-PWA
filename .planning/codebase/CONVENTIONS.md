# Coding Conventions

**Analysis Date:** 2026-02-03

## Naming Patterns

**Files:**
- JavaScript/services: `PascalCaseService.js` (e.g., `AuthService.js`, `CustomerService.js`)
- JavaScript/entry points: `camelCase.js` (e.g., `main.js`, `login.js`, `dashboard-home.js`)
- Go: `snake_case.go` for files, but single `main.go` entry point
- HTML templates: `kebab-case.html` (e.g., `dashboard-login.html`, `dashboard-home.html`)

**Functions/Methods:**
- JavaScript: `camelCase` (e.g., `getCustomerByPhone()`, `formatDisplayName()`, `normalizePhoneNumber()`)
- Go: `camelCase` (e.g., `register()`, `login()`, `respondError()`, `generateSessionID()`)
- Internal Go helpers (unexported): `camelCase` starting with lowercase (e.g., `respondError`, `normalizePhoneNumber`)

**Variables:**
- JavaScript: `camelCase` (e.g., `currentUser`, `speakerActive`, `otpCountdown`)
- Go: `camelCase` for local variables (e.g., `userID`, `sessionID`, `dbHost`)
- Go: `PascalCase` for struct fields and exported globals (e.g., `Success`, `User`, `Email`)
- Constants in Go: All caps with underscores for multi-word (e.g., `DefaultCost`)

**Types/Classes:**
- JavaScript: `PascalCase` for classes and interfaces (e.g., `AuthService`, `CallStore`, `ScreenController`)
- Go: `PascalCase` for struct names and types (e.g., `RegisterRequest`, `AuthResponse`, `Server`)
- Go: JSON tags use `snake_case` (e.g., `json:"first_name"`, `json:"company_id"`)

**Request/Response Types:**
- Go: Suffix with `Request` for input types, `Response` for output types (e.g., `RegisterRequest`, `AuthResponse`, `CustomerResponse`)

## Code Style

**Formatting:**
- JavaScript: No configured formatter (eslint/prettier not in dependencies)
- Vite build tool handles JS/CSS compilation
- CSS via Tailwind (utility-first) and PostCSS with autoprefixer

**Linting:**
- No linter configuration found in `app/` directory
- Go: No explicit linter configuration in API

**Import/Require Organization:**

JavaScript files follow this pattern:
1. Style imports first (CSS)
2. Service/library imports
3. Configuration imports
4. Local module imports

Example from `main.js`:
```javascript
import './styles/main.css';
import { callStore } from './js/services/CallStore.js';
import { ScreenController } from './js/ui/ScreenController.js';
import { authService } from './js/services/AuthService.js';
import { API_URL } from './config.js';
```

Go follows standard package organization:
```go
import (
  "context"
  "database/sql"
  // ...stdlib

  "omnicall/db"
  // ...local packages

  "github.com/go-chi/chi/v5"
  // ...third-party
)
```

## Error Handling

**JavaScript Patterns:**

- Try-catch with empty catch blocks returning null or error objects
- Errors logged to console before returning null
- Example from `CustomerService.js`:
```javascript
async getCustomerByPhone(phoneNumber) {
  try {
    const response = await fetch(/* ... */);
    if (!response.ok) {
      console.error('Failed to fetch customer:', response.statusText);
      return null;
    }
    // ...
  } catch (error) {
    console.error('Error fetching customer:', error);
    return null;
  }
}
```

- Service methods return status objects: `{ success: boolean, error?: string, data?: any }`
- Example from `AuthService.js`:
```javascript
return { success: true, user: data.user };
return { success: false, error: data.detail || 'Failed to register' };
```

**Go Patterns:**

- Early return pattern with error checks
- `respondError()` helper for HTTP error responses with logging
- All errors logged before responding
- Example from `main.go`:
```go
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
  respondError(w, http.StatusBadRequest, "Invalid request body")
  return
}
```

- Error response format uses `ErrorResponse` struct with `Detail` field
- `respondError()` logs with emoji prefix: `❌ ERROR [status]: message`

## Logging

**Framework:** Console logging via `console` (JS) and `log` package (Go)

**Patterns:**

JavaScript:
- Console methods: `console.log()`, `console.error()`, `console.warn()`
- Emoji prefixes for status: `🔄`, `✅`, `❌`, `📡`, `📦`, `🔍`, `📍`, `➕`, `📤`, `📧`
- Example: `console.log("🔄 Checking authentication status...")`

Go:
- `log.Printf()` for formatted output with timestamp (set via `log.SetFlags()`)
- Emoji prefixes: `❌`, `✅`, `📊`, `🔐`, `🏢`, `📞`, `🚀`
- Logs with context: `log.Printf("Connected to MySQL at %s:%s", dbHost, dbPort)`
- Development-focused: OTP logged to console and `otp.log` file for non-production

## Comments

**When to Comment:**
- Function/method documentation blocks (JSDoc style)
- Complex logic or non-obvious implementations
- Middleware explanations

**JSDoc/Comments Style:**

JavaScript classes and methods use block comments:
```javascript
/**
 * Get customer information by phone number
 * @param {string} phoneNumber - The phone number to lookup
 * @returns {Promise<Object|null>} Customer information or null if not found
 */
async getCustomerByPhone(phoneNumber) { ... }
```

Inline comments explain logic:
```javascript
// Remove all non-digits
let digits = number.replace(/\D/g, '');

// If starts with 0, replace with +27
if (digits.startsWith('0')) {
  digits = '27' + digits.substring(1);
}
```

## Function Design

**Size Guidelines:**
- Service methods: 10-40 lines (tend toward shorter with clear error handling)
- UI controller methods: 15-30 lines
- HTTP handlers: 20-60 lines (Go)

**Parameters:**
- JavaScript: Single parameters or objects for multiple related values
- Example: `normalizePhoneNumber(number)`, `formatCustomerInfo(customer)`
- Go: Receiver + parameters, context always first in handlers
- Example: `func (s *Server) register(w http.ResponseWriter, r *http.Request)`

**Return Values:**
- JavaScript: Single values, null/undefined for errors, or status objects `{ success, error, data }`
- Go: Multiple returns with error last: `(result, error)`
- Go HTTP handlers: Set headers and write response directly (no return)

## Module Design

**Exports:**

JavaScript:
- Services exported as singleton instances: `export const authService = new AuthService();`
- Classes exported for instantiation: `export class CallStore { ... }`
- Configuration exported as constants: `export const API_ENDPOINTS = { ... }`

Go:
- Request/Response types exported (PascalCase)
- Handler methods on `Server` receiver (exported)
- Helper functions lowercase (unexported)
- Database queries via `db.Queries` singleton: `s.queries.GetUserByEmail()`

**Barrel Files:**
- Not used (no index.js files for re-exports)
- Direct imports from source files

## State Management

**JavaScript:**
- Simple store pattern via `CallStore` class with manual subscription
- Observable pattern: `subscribe(listener)` returns unsubscribe function
- Direct mutation of state object: `this.state = { ... }`
- Listeners notified via `notify()` which posts messages to parent window

**Go:**
- Stateless handlers with dependency injection via `Server` struct
- `Server` holds `*sql.DB` and `*db.Queries` (database access)
- Session state stored in database, retrieved via session ID from cookie

## Configuration

**Frontend:**
- Centralized in `config.js`: `API_URL`, `API_ENDPOINTS` (object with endpoint URLs and factories)
- Environment variables via Vite (would use `import.meta.env.VITE_*`)
- Currently `API_URL` is empty string (relative paths used)

**Backend:**
- Environment variables only (no .env parsing for production-ready code)
- Uses `godotenv` for development `.env` files
- Required vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PORT`
- Optional: `ALLOWED_ORIGINS` (comma-separated CORS origins)

---

*Convention analysis: 2026-02-03*
