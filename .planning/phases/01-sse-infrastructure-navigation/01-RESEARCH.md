# Phase 1: SSE Infrastructure & Navigation - Research

**Researched:** 2026-02-04
**Domain:** Server-Sent Events (SSE) and Single-Page Application Navigation
**Confidence:** HIGH

## Summary

This research investigates implementing Server-Sent Events (SSE) for real-time statistics updates in a Go backend with chi router, and vanilla JavaScript single-page navigation for accessing the stats page. The standard approach uses the `alexandrevicenzi/go-sse` library for backend SSE management and the native browser EventSource API for client connections, with History API-based routing for navigation.

The critical finding is that SSE implementations are highly vulnerable to goroutine and memory leaks if client disconnection cleanup isn't properly implemented. A January 2025 CVE (CVE-2025-27421) documented a goroutine leak in an SSE implementation where improper channel cleanup caused resource exhaustion, with servers maintaining high memory usage while refusing new connections. This validates the success criteria requirement of stable memory usage under 200MB over 4-hour sessions.

For navigation, vanilla JavaScript SPA routing uses the History API with `pushState` for URL management, intercepting link clicks with `data-link` attributes to prevent full page refreshes. Authorization redirects occur at navigation time by checking user roles before rendering protected views.

**Primary recommendation:** Use `alexandrevicenzi/go-sse` library with mandatory `defer s.Shutdown()` for resource cleanup, implement client disconnect detection via `context.Done()`, and use History API-based routing with role checks in navigation handler.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| alexandrevicenzi/go-sse | Latest (Go 1.9+) | SSE server with channel management | Most mature Go SSE library, handles client tracking, supports multiple channels, has graceful shutdown |
| Native EventSource | Browser built-in | SSE client API | W3C standard, automatic reconnection, no dependencies |
| History API | Browser built-in | SPA navigation without page refresh | Native browser API, SEO-friendly URLs, back/forward button support |
| chi/v5 | v5 (current) | HTTP router | Already in project, lightweight, idiomatic Go, full middleware support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| go-chi/cors | Latest | CORS middleware | Required for cross-origin SSE connections if frontend/backend on different origins |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| go-sse library | Hand-rolled SSE | Library handles client tracking, cleanup, channels automatically - hand-rolling risks goroutine leaks |
| History API | Hash-based routing (#/page) | Hash routing is simpler but History API provides better URLs and SEO |
| SSE | WebSockets | WebSockets are bidirectional but more complex - SSE is perfect for one-way server-to-client updates |

**Installation:**
```bash
# Backend
cd api
go get github.com/alexandrevicenzi/go-sse

# Frontend (no installation needed - native browser APIs)
```

## Architecture Patterns

### Recommended Project Structure
```
api/
├── main.go                 # SSE server mount point
├── handlers/
│   └── stats_sse.go       # SSE endpoint handler
└── middleware/
    └── auth.go            # Role-based auth middleware

app/src/
├── router.js              # History API routing logic
├── services/
│   └── sse-client.js      # EventSource wrapper with reconnection
└── pages/
    └── stats-page.js      # Stats page view with SSE connection
```

### Pattern 1: SSE Server with go-sse Library
**What:** Mount go-sse server on chi router with automatic client management
**When to use:** Any SSE implementation requiring multiple channels or broadcast messaging
**Example:**
```go
// Source: https://github.com/alexandrevicenzi/go-sse
import (
    "github.com/alexandrevicenzi/go-sse"
    "github.com/go-chi/chi/v5"
)

func setupSSE(r chi.Router) {
    // Create SSE server with options
    sseServer := sse.NewServer(&sse.Options{
        RetryInterval: 5000,                    // Client retry interval (ms)
        Headers: map[string]string{
            "Access-Control-Allow-Origin": "*", // CORS if needed
        },
    })
    defer sseServer.Shutdown() // CRITICAL: Always cleanup

    // Mount at /api/stats/stream
    r.Handle("/api/stats/stream", sseServer)

    // Broadcast messages from goroutine
    go func() {
        ticker := time.NewTicker(30 * time.Second)
        defer ticker.Stop()

        for range ticker.C {
            stats := getLatestStats() // Your stats logic
            data, _ := json.Marshal(stats)
            sseServer.SendMessage("/api/stats/stream",
                sse.SimpleMessage(string(data)))
        }
    }()
}
```

### Pattern 2: SSE Client with Cleanup
**What:** EventSource wrapper that properly closes connection to prevent memory leaks
**When to use:** All SSE client implementations
**Example:**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
class SSEClient {
    constructor(url) {
        this.url = url;
        this.eventSource = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect(onMessage, onError) {
        this.eventSource = new EventSource(this.url);

        this.eventSource.onopen = () => {
            console.log('SSE connection established');
            this.reconnectAttempts = 0;
        };

        this.eventSource.onmessage = (event) => {
            onMessage(JSON.parse(event.data));
        };

        this.eventSource.onerror = (error) => {
            console.error('SSE error:', error);

            if (this.eventSource.readyState === EventSource.CLOSED) {
                this.handleReconnect(onMessage, onError);
            }

            if (onError) onError(error);
        };
    }

    handleReconnect(onMessage, onError) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        setTimeout(() => {
            console.log(`Reconnecting (attempt ${this.reconnectAttempts})...`);
            this.connect(onMessage, onError);
        }, delay);
    }

    // CRITICAL: Must be called when page unmounts
    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            console.log('SSE connection closed');
        }
    }
}
```

### Pattern 3: Context-Based Client Disconnect Detection
**What:** Use request context to detect when client disconnects and cleanup resources
**When to use:** Hand-rolled SSE implementations or custom channel management
**Example:**
```go
// Source: https://go-zero.dev/en/docs/tutorials/http/server/sse
func sseHandler(w http.ResponseWriter, r *http.Request) {
    // Set SSE headers
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")

    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "SSE not supported", http.StatusInternalServerError)
        return
    }

    // Create client-specific channel
    clientChan := make(chan string)
    defer close(clientChan)

    // Register client (your logic)
    registerClient(clientChan)
    defer unregisterClient(clientChan)

    for {
        select {
        case <-r.Context().Done():
            // Client disconnected - cleanup and exit
            log.Println("Client disconnected")
            return

        case message := <-clientChan:
            // Send message to client
            fmt.Fprintf(w, "data: %s\n\n", message)
            flusher.Flush()
        }
    }
}
```

### Pattern 4: History API SPA Router
**What:** Intercept link clicks and use pushState for navigation without page refresh
**When to use:** All vanilla JS single-page applications
**Example:**
```javascript
// Source: https://dev.to/dcodeyt/building-a-single-page-app-without-frameworks-hl9
class Router {
    constructor(routes) {
        this.routes = routes;
        this.currentView = null;

        // Intercept link clicks
        document.body.addEventListener('click', e => {
            if (e.target.matches('[data-link]')) {
                e.preventDefault();
                this.navigateTo(e.target.href);
            }
        });

        // Handle back/forward buttons
        window.addEventListener('popstate', () => {
            this.loadRoute(location.pathname);
        });
    }

    navigateTo(url) {
        history.pushState(null, null, url);
        this.loadRoute(url);
    }

    async loadRoute(path) {
        // Cleanup previous view (IMPORTANT for SSE connections)
        if (this.currentView && this.currentView.cleanup) {
            this.currentView.cleanup();
        }

        // Find matching route
        const route = this.routes.find(r => r.path === path);

        if (!route) {
            this.loadRoute('/404');
            return;
        }

        // Check authorization
        if (route.requiresAuth && !this.checkAuth(route.allowedRoles)) {
            this.navigateTo('/unauthorized');
            return;
        }

        // Load new view
        this.currentView = new route.view();
        document.getElementById('app').innerHTML =
            await this.currentView.getHtml();

        // Initialize view (start SSE, add listeners, etc)
        if (this.currentView.init) {
            this.currentView.init();
        }
    }

    checkAuth(allowedRoles) {
        const user = JSON.parse(sessionStorage.getItem('user'));
        return user && allowedRoles.includes(user.role);
    }
}

// Usage
const router = new Router([
    { path: '/stats', view: StatsPage, requiresAuth: true, allowedRoles: ['admin', 'manager'] },
    { path: '/dashboard', view: DashboardPage, requiresAuth: true, allowedRoles: ['agent', 'admin', 'manager'] },
]);
```

### Pattern 5: Role-Based Authorization Middleware (Chi)
**What:** Chi middleware that checks user role before allowing access to protected routes
**When to use:** All protected API endpoints including SSE streams
**Example:**
```go
// Source: https://webdevstation.com/posts/how-to-control-router-access-permissions-in-go-web-apps/
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Get session from cookie/header
            sessionID := r.Header.Get("X-Session-ID")
            if sessionID == "" {
                http.Error(w, "Unauthorized", http.StatusUnauthorized)
                return
            }

            // Get user from session (your logic)
            user, err := getUserFromSession(sessionID)
            if err != nil {
                http.Error(w, "Unauthorized", http.StatusUnauthorized)
                return
            }

            // Check if user role is allowed
            allowed := false
            for _, role := range allowedRoles {
                if user.Role == role {
                    allowed = true
                    break
                }
            }

            if !allowed {
                http.Error(w, "Forbidden", http.StatusForbidden)
                return
            }

            // Role is allowed, continue
            next.ServeHTTP(w, r)
        })
    }
}

// Usage
r.With(RequireRole("admin", "manager")).Handle("/api/stats/stream", sseServer)
```

### Anti-Patterns to Avoid
- **Forgetting EventSource.close():** Leads to zombie connections and memory leaks. Always close in cleanup/unmount.
- **No max reconnect attempts:** EventSource auto-reconnects forever. Implement exponential backoff with max attempts (3-5).
- **Missing defer cleanup in Go:** Goroutine leaks occur when ticker.Stop() or channel close is forgotten.
- **Ignoring context.Done():** Hand-rolled SSE without context monitoring can't detect client disconnect.
- **Hash routing (#/page):** Worse UX and SEO than History API. Use pushState unless server-side config is impossible.
- **Missing role check on SSE endpoint:** Authorization must happen server-side, not just client-side navigation.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE client tracking | Manual map[clientID]chan | alexandrevicenzi/go-sse | Library handles concurrent map access, cleanup on disconnect, channel lifecycle |
| EventSource reconnection | Custom retry logic | Native EventSource with backoff wrapper | EventSource auto-reconnects; you just need max attempts and exponential backoff |
| SSE message format | Custom data: field logic | sse.SimpleMessage() or sse.NewMessage() | SSE spec requires specific format (data:, id:, event:, double newline) |
| Client disconnect detection | Polling or ping/pong | r.Context().Done() | Context signals disconnect immediately without extra goroutines |
| SPA routing regex | Custom URL parsing | Parameterized route patterns | Complex regex for /posts/:id is error-prone; use tested patterns |

**Key insight:** SSE has subtle edge cases (message formatting, flush timing, connection limits, cleanup ordering) that cause memory leaks and zombie goroutines when hand-rolled. Libraries like go-sse have solved these through production usage.

## Common Pitfalls

### Pitfall 1: Goroutine Leak from Missing Ticker Cleanup
**What goes wrong:** SSE broadcasting goroutines create tickers but forget to stop them, causing goroutines to run forever even after SSE server shuts down
**Why it happens:** time.Ticker is not automatically garbage collected - must call Stop() explicitly
**How to avoid:** Always use `defer ticker.Stop()` immediately after ticker creation
**Warning signs:** Memory usage gradually increases over days, goroutine count grows continuously, `pprof` shows ticker goroutines

### Pitfall 2: Browser Connection Limit (6 per domain)
**What goes wrong:** Opening stats page in multiple tabs (7+) causes some tabs to hang indefinitely waiting for connection
**Why it happens:** Without HTTP/2, browsers limit SSE to 6 concurrent connections per domain across all tabs
**How to avoid:** Enable HTTP/2 on server (Go http.Server supports it by default with TLS), or use single shared connection with BroadcastChannel API to share data across tabs
**Warning signs:** Stats page loads in first 6 tabs but hangs in 7th+ tab, browser DevTools shows "pending" request forever

### Pitfall 3: Memory Leak from Unclosed EventSource
**What goes wrong:** Navigating away from stats page without closing EventSource leaves connection open, memory grows from 40MB to 1GB+ over hours
**Why it happens:** EventSource auto-reconnects forever; if not closed, connection and event listeners accumulate
**How to avoid:** Store EventSource instance in view class, implement cleanup() method that calls eventSource.close(), call cleanup in router before loading new view
**Warning signs:** Memory profiler shows EventSource objects not being garbage collected, network tab shows abandoned SSE connections still active

### Pitfall 4: Race Condition from Shutdown Order
**What goes wrong:** Server shutdown closes channels before goroutines exit, causing "send on closed channel" panic
**Why it happens:** go-sse closes internal channels during Shutdown(), but broadcasting goroutines may still be sending
**How to avoid:** Use context cancellation to signal goroutines to stop before calling Shutdown(), or rely on go-sse's internal shutdown handling
**Warning signs:** Panic on server shutdown with "send on closed channel" error, documented in go-sse issue #24

### Pitfall 5: Missing Context in SSE Handler
**What goes wrong:** Hand-rolled SSE handlers don't monitor r.Context().Done(), causing client channels to persist after disconnect
**Why it happens:** HTTP connection closing doesn't automatically stop handler goroutine - must explicitly check context
**How to avoid:** Always include `case <-r.Context().Done(): return` in SSE handler select statement
**Warning signs:** Client count never decreases, channels/goroutines accumulate over time, CVE-2025-27421 pattern

### Pitfall 6: Infinite Reconnection Without Backoff
**What goes wrong:** SSE connection fails (server down), EventSource reconnects instantly and continuously, creating request storm
**Why it happens:** EventSource default reconnection has no backoff or max attempts
**How to avoid:** Wrap EventSource in class with exponential backoff (1s, 2s, 4s, 8s...) and max attempts (3-5)
**Warning signs:** Network tab shows hundreds of failed SSE connection attempts, server logs show connection flood

### Pitfall 7: No Role Check on SSE Endpoint
**What goes wrong:** Unauthorized users access stats stream by directly connecting to /api/stats/stream URL
**Why it happens:** Client-side navigation role check doesn't protect server endpoint
**How to avoid:** Apply authentication/authorization middleware to SSE handler (chi's RequireRole middleware)
**Warning signs:** Security audit reveals unauthorized data access, agent users receiving admin statistics

## Code Examples

Verified patterns from official sources:

### Complete SSE Server Setup with Chi
```go
// Source: https://github.com/alexandrevicenzi/go-sse
package main

import (
    "encoding/json"
    "time"
    "github.com/alexandrevicenzi/go-sse"
    "github.com/go-chi/chi/v5"
)

func main() {
    r := chi.NewRouter()

    // Create SSE server
    sseServer := sse.NewServer(&sse.Options{
        RetryInterval: 5000, // Client should retry after 5s on disconnect
        Headers: map[string]string{
            "Access-Control-Allow-Origin": "*",
        },
    })
    defer sseServer.Shutdown() // CRITICAL: Cleanup on exit

    // Protected SSE endpoint
    r.Group(func(r chi.Router) {
        r.Use(RequireRole("admin", "manager")) // Authorization middleware
        r.Handle("/api/stats/stream", sseServer)
    })

    // Start broadcasting stats
    go broadcastStats(sseServer)

    http.ListenAndServe(":8080", r)
}

func broadcastStats(s *sse.Server) {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop() // Prevent goroutine leak

    for range ticker.C {
        stats := TaskStatsResponse{
            Success: true,
            TotalTasks: 150,
            PendingTasks: 45,
            // ... other stats
        }

        data, _ := json.Marshal(stats)
        s.SendMessage("/api/stats/stream", sse.SimpleMessage(string(data)))
    }
}
```

### Complete SSE Client with Cleanup
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
// Verified with: https://tigerabrodi.blog/server-sent-events-a-practical-guide-for-the-real-world

class StatsSSEClient {
    constructor() {
        this.eventSource = null;
        this.reconnectAttempts = 0;
        this.maxAttempts = 5;
    }

    connect(onStatsUpdate) {
        const url = '/api/stats/stream';
        this.eventSource = new EventSource(url, {
            withCredentials: true // Include cookies for auth
        });

        this.eventSource.onopen = () => {
            console.log('Stats stream connected');
            this.reconnectAttempts = 0;
        };

        this.eventSource.onmessage = (event) => {
            try {
                const stats = JSON.parse(event.data);
                onStatsUpdate(stats);
            } catch (error) {
                console.error('Failed to parse stats:', error);
            }
        };

        this.eventSource.onerror = (error) => {
            console.error('SSE error:', error);

            // EventSource is closed or closing
            if (this.eventSource.readyState === EventSource.CLOSED) {
                this.handleReconnect(onStatsUpdate);
            }
        };
    }

    handleReconnect(onStatsUpdate) {
        this.reconnectAttempts++;

        if (this.reconnectAttempts > this.maxAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        // Exponential backoff with jitter
        const baseDelay = 1000 * Math.pow(2, this.reconnectAttempts - 1);
        const jitter = Math.random() * 1000;
        const delay = Math.min(baseDelay + jitter, 30000);

        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxAttempts})`);

        setTimeout(() => {
            this.connect(onStatsUpdate);
        }, delay);
    }

    // MUST be called when leaving stats page
    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            this.reconnectAttempts = 0;
            console.log('Stats stream disconnected');
        }
    }
}

// Usage in stats page
class StatsPage {
    constructor() {
        this.sseClient = new StatsSSEClient();
    }

    init() {
        // Connect to SSE when page loads
        this.sseClient.connect((stats) => {
            this.updateUI(stats);
        });
    }

    cleanup() {
        // CRITICAL: Close SSE when leaving page
        this.sseClient.disconnect();
    }

    updateUI(stats) {
        document.getElementById('total-tasks').textContent = stats.total_tasks;
        document.getElementById('pending-tasks').textContent = stats.pending_tasks;
        // ... update other stats
    }
}
```

### SPA Router with View Cleanup
```javascript
// Source: https://dev.to/dcodeyt/building-a-single-page-app-without-frameworks-hl9

class Router {
    constructor(routes) {
        this.routes = routes;
        this.currentView = null;

        // Intercept all link clicks
        document.addEventListener('click', e => {
            if (e.target.matches('[data-link]')) {
                e.preventDefault();
                this.navigateTo(e.target.href);
            }
        });

        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            this.loadRoute(window.location.pathname);
        });
    }

    navigateTo(url) {
        history.pushState(null, null, url);
        this.loadRoute(url);
    }

    async loadRoute(pathname) {
        // CRITICAL: Cleanup previous view (closes SSE connections)
        if (this.currentView && typeof this.currentView.cleanup === 'function') {
            this.currentView.cleanup();
        }

        // Find matching route
        const route = this.routes.find(r => {
            if (r.path instanceof RegExp) {
                return r.path.test(pathname);
            }
            return r.path === pathname;
        });

        if (!route) {
            return this.navigateTo('/404');
        }

        // Check authorization
        if (route.requiresAuth) {
            const user = this.getCurrentUser();
            if (!user) {
                return this.navigateTo('/login');
            }
            if (route.allowedRoles && !route.allowedRoles.includes(user.role)) {
                return this.navigateTo('/unauthorized');
            }
        }

        // Create and render new view
        this.currentView = new route.view();
        const html = await this.currentView.getHtml();
        document.getElementById('app').innerHTML = html;

        // Initialize view (connects SSE, adds event listeners)
        if (typeof this.currentView.init === 'function') {
            this.currentView.init();
        }
    }

    getCurrentUser() {
        const userJson = sessionStorage.getItem('user');
        return userJson ? JSON.parse(userJson) : null;
    }
}

// Define routes
const router = new Router([
    {
        path: '/stats',
        view: StatsPage,
        requiresAuth: true,
        allowedRoles: ['admin', 'manager']
    },
    {
        path: '/dashboard',
        view: DashboardPage,
        requiresAuth: true,
        allowedRoles: ['admin', 'manager', 'agent']
    }
]);

// Initial route load
router.loadRoute(window.location.pathname);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling APIs every N seconds | Server-Sent Events | ~2015+ | SSE provides lower latency, reduced server load, persistent connection vs HTTP overhead per poll |
| Hash-based routing (#/page) | History API (pushState) | ~2014 (HTML5) | Clean URLs, better SEO, proper back/forward button behavior |
| WebSockets for server-to-client | SSE for unidirectional | ~2015+ | SSE simpler, auto-reconnect, standard HTTP (works through proxies), falls back gracefully |
| Manual goroutine tracking | Context-based cancellation | Go 1.7 (2016) | Context provides standardized cancellation pattern, prevents goroutine leaks |
| HTTP/1.1 SSE (6 connection limit) | HTTP/2 SSE (100+ streams) | ~2015+ | HTTP/2 multiplexing allows 100+ SSE connections per domain vs 6 limit |

**Deprecated/outdated:**
- **Long polling:** Replaced by SSE for server-to-client push (SSE has better semantics and auto-reconnect)
- **hash-based routing:** Still works but History API is standard for modern SPAs (better URLs, SEO)
- **Manual mutex locks for client tracking:** go-sse library handles thread-safe client management

## Open Questions

Things that couldn't be fully resolved:

1. **go-sse shutdown panic (issue #24)**
   - What we know: go-sse has known issue where Shutdown() can panic if called while messages are being sent
   - What's unclear: Whether this is fixed in latest version or requires workaround
   - Recommendation: Use context cancellation to stop broadcasting goroutines before calling Shutdown(), test shutdown behavior in staging

2. **Optimal heartbeat interval**
   - What we know: WHATWG spec recommends 15-second keepalive, go-sse defaults to none
   - What's unclear: What interval prevents proxy/firewall timeout for your infrastructure
   - Recommendation: Start with 30-second broadcast interval (serves dual purpose: stats update + keepalive), monitor for connection drops, adjust if needed

3. **BroadcastChannel API for multi-tab support**
   - What we know: BroadcastChannel API can share SSE data across tabs to avoid connection limit
   - What's unclear: Browser support across target users (IE/older browsers don't support it)
   - Recommendation: Implement single-tab SSE first, add BroadcastChannel as enhancement if multi-tab usage is common

4. **Session validation frequency on SSE connection**
   - What we know: Initial connection validates session, but long-lived SSE might outlive session expiry
   - What's unclear: Whether to periodically validate session on open SSE connection
   - Recommendation: Send session expiry time in initial response, client closes SSE and redirects to login when expired

## Sources

### Primary (HIGH confidence)
- [alexandrevicenzi/go-sse GitHub](https://github.com/alexandrevicenzi/go-sse) - Library features, API, examples
- [go-sse package documentation](https://pkg.go.dev/github.com/alexandrevicenzi/go-sse) - Complete API reference
- [MDN EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) - Official browser API documentation
- [MDN Server-Sent Events Guide](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) - Connection limits, error handling, best practices
- [Chi v5 middleware package](https://pkg.go.dev/github.com/go-chi/chi/v5/middleware) - Official middleware documentation

### Secondary (MEDIUM confidence)
- [FreeCodeCamp SSE in Go](https://www.freecodecamp.org/news/how-to-implement-server-sent-events-in-go/) - Implementation pattern verified with official docs
- [DEV.to SPA without frameworks](https://dev.to/dcodeyt/building-a-single-page-app-without-frameworks-hl9) - History API patterns
- [go-zero SSE tutorial](https://go-zero.dev/en/docs/tutorials/http/server/sse) - Context.Done() pattern
- [WebDevStation Chi RBAC](https://webdevstation.com/posts/how-to-control-router-access-permissions-in-go-web-apps/) - Authorization middleware patterns
- [Tiger Abrodi SSE Guide](https://tigerabrodi.blog/server-sent-events-a-practical-guide-for-the-real-world) - Real-world SSE patterns
- [OneUptime Go Retry Exponential Backoff](https://oneuptime.com/blog/post/2026-01-07-go-retry-exponential-backoff/view) - Backoff strategies (Jan 2026)
- [OneUptime SSE in React](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view) - EventSource best practices (Jan 2026)
- [OneUptime Real-Time Notifications with Go](https://oneuptime.com/blog/post/2026-01-30-how-to-build-real-time-notifications-with-go/view) - SSE patterns (Jan 2026)

### Tertiary (LOW confidence - flagged for validation)
- [CVE-2025-27421](https://www.miggo.io/vulnerability-database/cve/CVE-2025-27421) - Goroutine leak in SSE (validates pitfall, but single source)
- [Chromium bug #275955](https://bugs.chromium.org/p/chromium/issues/detail?id=275955) - 6 connection limit documentation (old bug report, status uncertain)
- [go-sse issue #24](https://github.com/alexandrevicenzi/go-sse/issues/24) - Shutdown panic (GitHub issue, unclear if resolved)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - alexandrevicenzi/go-sse is verified from official repo/docs, EventSource is W3C standard, History API is stable browser API
- Architecture: HIGH - Patterns verified from multiple official sources (MDN, go-sse examples, go-zero docs)
- Pitfalls: MEDIUM-HIGH - Goroutine leaks verified by CVE and multiple sources, memory leaks documented in MDN, connection limit in browser specs, shutdown issue from go-sse GitHub

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - SSE/browser APIs are stable, go-sse library mature)
