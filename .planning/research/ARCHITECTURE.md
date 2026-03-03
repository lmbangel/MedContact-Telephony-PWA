# Architecture Research: Real-Time Stats Dashboard

**Domain:** Real-time analytics dashboard with role-based data filtering
**Researched:** 2026-02-03
**Confidence:** HIGH

## Recommended Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Stats Page   │  │ Chart        │  │ Filter       │              │
│  │ Component    │  │ Components   │  │ Components   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                  │                       │
│  ┌──────┴─────────────────┴──────────────────┴───────┐              │
│  │          StatsService (manages state)             │              │
│  └──────┬────────────────────────────────────┬───────┘              │
│         │                                     │                      │
│         │ HTTP (initial load)                 │ SSE (real-time)      │
│         ↓                                     ↓                      │
├─────────────────────────────────────────────────────────────────────┤
│                         API LAYER (Chi Router)                       │
├─────────────────────────────────────────────────────────────────────┤
│  GET /api/stats/aggregated    →   AggregatedStatsHandler            │
│  GET /api/stats/stream         →   SSEHandler (EventSource)         │
│  GET /api/stats/export         →   ExportHandler (CSV/Excel)        │
├─────────────────────────────────────────────────────────────────────┤
│                         BUSINESS LOGIC LAYER                         │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Stats            │  │ Role-Based       │  │ SSE Broadcast    │  │
│  │ Aggregator       │  │ Filter           │  │ Manager          │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                     │                      │             │
│           │  Query Builder      │  Filter Builder      │  PubSub     │
│           ↓                     ↓                      ↓             │
├─────────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                                   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    MySQL Database (sqlc)                      │   │
│  │  calls table  |  tasks table  |  users table  |  sessions    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **Stats Page Component** | UI orchestration, chart rendering, filter management | StatsService, Chart Components |
| **StatsService** | State management, API calls, SSE connection lifecycle | API endpoints, EventSource API |
| **Chart Components** | Data visualization (Chart.js), responsive rendering | Stats Page, StatsService |
| **Filter Components** | Time range picker, role-based scope selector | Stats Page, StatsService |
| **AggregatedStatsHandler** | Query stats with role-based filtering, return JSON | RoleBasedFilter, StatsAggregator |
| **SSEHandler** | Maintain persistent connections, push updates on changes | SSE Broadcast Manager, connected clients |
| **StatsAggregator** | Build aggregation queries, execute via sqlc | MySQL via sqlc queries |
| **RoleBasedFilter** | Apply visibility rules (admin→company, manager→reports, support→all) | User session, database queries |
| **SSE Broadcast Manager** | Track active connections, broadcast to relevant clients | SSE connections, database triggers |

## Recommended Project Structure

### Backend (Go)
```
api/
├── handlers/
│   ├── stats_handler.go       # GET /api/stats/aggregated
│   ├── sse_handler.go          # GET /api/stats/stream (SSE endpoint)
│   └── export_handler.go       # GET /api/stats/export
├── services/
│   ├── stats_service.go        # Business logic for aggregations
│   ├── role_filter.go          # Role-based visibility filtering
│   └── sse_broadcaster.go      # Manage SSE connections and broadcasts
├── db/
│   ├── queries.sql             # sqlc queries for stats aggregation
│   ├── queries.sql.go          # Generated sqlc code
│   └── models.go               # sqlc models
└── main.go                     # Chi router setup
```

### Frontend (Vanilla JS)
```
app/src/
├── stats-page.js                   # Main stats page entry point
├── js/
│   ├── services/
│   │   ├── StatsService.js         # Manages stats state, API calls, SSE
│   │   └── ExportService.js        # CSV/Excel download handling
│   ├── components/
│   │   ├── StatsSummaryCards.js    # Metric cards UI
│   │   ├── StatsCharts.js          # Chart.js wrapper components
│   │   ├── StatsTable.js           # Agent breakdown table
│   │   ├── TimeRangeFilter.js      # Date range picker
│   │   └── ScopeFilter.js          # Company/agent selector (role-based)
│   └── utils/
│       └── chartHelpers.js         # Chart.js configuration utilities
```

### Structure Rationale

- **handlers/**: Separate HTTP handlers for clean separation of routing and logic
- **services/**: Business logic isolated from HTTP layer, easier to test
- **sse_broadcaster.go**: Central SSE connection management prevents memory leaks
- **StatsService.js**: Single source of truth for stats state, manages both HTTP and SSE data
- **components/**: Reusable UI components aligned with existing Vanilla JS service pattern

## Architectural Patterns

### Pattern 1: SSE for Real-Time Updates

**What:** Server-Sent Events provide unidirectional server-to-client push for stats updates

**When to use:** When you need real-time dashboard updates without WebSocket bidirectional overhead

**Trade-offs:**
- ✅ Simpler than WebSocket (unidirectional only)
- ✅ Automatic reconnection handled by browser
- ✅ Standard HTTP, works through proxies
- ⚠️ Unidirectional only (client can't push, only listen)
- ⚠️ Limited to 6 concurrent connections per domain (HTTP/1.1), 100+ with HTTP/2

**Example:**
```go
// Backend: SSE Handler (Go + Chi)
func (s *Server) handleStatsStream(w http.ResponseWriter, r *http.Request) {
    // Set SSE headers
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")

    // Get user role-based filter
    user := getUserFromSession(r)
    filter := buildRoleFilter(user)

    // Create client channel
    clientChan := make(chan StatsUpdate)
    s.sseBroadcaster.Register(user.ID, filter, clientChan)
    defer s.sseBroadcaster.Unregister(user.ID)

    // Keep connection alive and push updates
    for {
        select {
        case update := <-clientChan:
            data, _ := json.Marshal(update)
            fmt.Fprintf(w, "data: %s\n\n", data)
            w.(http.Flusher).Flush()
        case <-r.Context().Done():
            return
        case <-time.After(15 * time.Second):
            // Keepalive ping
            fmt.Fprintf(w, ":keepalive\n\n")
            w.(http.Flusher).Flush()
        }
    }
}
```

```javascript
// Frontend: EventSource Consumer (Vanilla JS)
class StatsService {
    constructor() {
        this.eventSource = null;
        this.listeners = [];
    }

    startRealTimeUpdates() {
        this.eventSource = new EventSource('/api/stats/stream');

        this.eventSource.onmessage = (event) => {
            const update = JSON.parse(event.data);
            this.notifyListeners(update);
        };

        this.eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            // Browser automatically reconnects
        };
    }

    stopRealTimeUpdates() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(update) {
        this.listeners.forEach(cb => cb(update));
    }
}
```

### Pattern 2: Role-Based Data Filtering at Query Level

**What:** Apply visibility rules in SQL queries, not in application code

**When to use:** Multi-tenant systems with role-based access control

**Trade-offs:**
- ✅ Security enforced at database layer
- ✅ Better performance (less data transferred)
- ✅ Single source of truth for access rules
- ⚠️ More complex SQL queries
- ⚠️ Requires careful testing of access boundaries

**Example:**
```sql
-- queries.sql (sqlc)

-- name: GetAggregatedStatsForUser :one
SELECT
    COUNT(DISTINCT c.id) as total_calls,
    COUNT(DISTINCT CASE WHEN c.call_status = 'completed' THEN c.id END) as answered_calls,
    AVG(c.duration) as avg_duration,
    COUNT(DISTINCT t.id) as total_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks
FROM calls c
LEFT JOIN tasks t ON t.call_id = c.id
WHERE
    -- Role-based filtering
    CASE
        -- Support sees all companies
        WHEN @user_role = 'support' THEN TRUE
        -- Admin sees their company
        WHEN @user_role = 'admin' THEN c.company_id = @user_company_id
        -- Manager sees their reports
        WHEN @user_role = 'manager' THEN c.agent_id IN (
            SELECT id FROM users WHERE manager_id = @user_id
        )
        -- Agent sees only their own
        ELSE c.agent_id = @user_id
    END
    -- Time filter
    AND c.created_at >= @start_time
    AND c.created_at <= @end_time;
```

### Pattern 3: Aggregation with Time-Based Materialized Views

**What:** Pre-aggregate common time ranges (today, this week, this month) for faster queries

**When to use:** When query performance degrades due to large datasets

**Trade-offs:**
- ✅ 10-1000x faster queries on aggregated data
- ✅ Reduces database load for common filters
- ⚠️ Additional storage required
- ⚠️ Requires background job to refresh materialized views

**Example:**
```sql
-- Daily stats materialized view (refreshed every hour)
CREATE TABLE daily_stats_cache AS
SELECT
    DATE(created_at) as stat_date,
    company_id,
    agent_id,
    COUNT(*) as call_count,
    SUM(CASE WHEN call_status = 'completed' THEN 1 ELSE 0 END) as answered_count,
    AVG(duration) as avg_duration
FROM calls
GROUP BY DATE(created_at), company_id, agent_id;

-- Query uses cache for historical data, live data for today
SELECT * FROM daily_stats_cache WHERE stat_date < CURDATE()
UNION ALL
SELECT
    DATE(created_at), company_id, agent_id,
    COUNT(*), SUM(...), AVG(...)
FROM calls
WHERE DATE(created_at) = CURDATE()
GROUP BY DATE(created_at), company_id, agent_id;
```

### Pattern 4: Chart.js with Incremental Updates

**What:** Update Chart.js data incrementally instead of recreating entire chart

**When to use:** Real-time dashboards with frequent updates

**Trade-offs:**
- ✅ Smooth animations, no flickering
- ✅ Better performance (no chart recreation)
- ✅ Maintains user interactions (zoom, hover)
- ⚠️ Requires tracking chart instances
- ⚠️ More complex update logic

**Example:**
```javascript
// Chart component with incremental updates
class StatsChart {
    constructor(canvasId, chartConfig) {
        this.chart = new Chart(
            document.getElementById(canvasId),
            chartConfig
        );
    }

    // Incremental update (used for SSE updates)
    updateData(newDataPoint) {
        this.chart.data.labels.push(newDataPoint.time);
        this.chart.data.datasets[0].data.push(newDataPoint.value);

        // Keep only last 50 points
        if (this.chart.data.labels.length > 50) {
            this.chart.data.labels.shift();
            this.chart.data.datasets[0].data.shift();
        }

        this.chart.update('none'); // Update without animation
    }

    // Full replace (used for filter changes)
    replaceData(newData) {
        this.chart.data = newData;
        this.chart.update(); // Update with animation
    }
}
```

## Data Flow

### Request Flow: Initial Page Load

```
[User navigates to /stats]
    ↓
[stats-page.js loads]
    ↓
[StatsService.fetchInitialStats()]
    ↓
GET /api/stats/aggregated?time=today
    ↓
[AggregatedStatsHandler]
    ↓ (getUserFromSession)
[Determine user role & scope]
    ↓ (buildRoleFilter)
[Query database with role-based WHERE clause]
    ↓ (sqlc queries)
[MySQL: aggregate calls, tasks by filtered scope]
    ↓
[JSON response: { total_calls, answered_calls, ... }]
    ↓
[StatsService updates state]
    ↓
[Chart components render initial data]
    ↓
[StatsService.startRealTimeUpdates()]
    ↓
[EventSource('/api/stats/stream')]
```

### Real-Time Update Flow

```
[Database change: new call completed]
    ↓
[Application inserts/updates calls table]
    ↓
[SSE Broadcaster detects change] (polling or trigger-based)
    ↓
[Calculate delta stats]
    ↓
[For each active SSE connection:]
    ↓ (check role-based filter)
[Does this change affect this client's scope?]
    ↓ YES
[Push update via SSE]
    ↓
[EventSource.onmessage fires in browser]
    ↓
[StatsService.notifyListeners(update)]
    ↓
[Chart component incremental update]
```

### Filter Change Flow

```
[User changes time filter: "Today" → "This Week"]
    ↓
[TimeRangeFilter.onChange()]
    ↓
[StatsService.applyFilter({ time: 'week' })]
    ↓
[Close existing SSE connection]
    ↓
GET /api/stats/aggregated?time=week
    ↓
[Full data refresh]
    ↓
[Chart.replaceData(newData)]
    ↓
[Reopen SSE connection with new filter]
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-100 concurrent users** | Single Go server, direct MySQL queries, in-memory SSE connection tracking. No caching needed. |
| **100-1K concurrent users** | Add Redis for SSE connection registry (distributed SSE), implement daily stats cache table, enable MySQL query cache, consider connection pooling limits. |
| **1K-10K concurrent users** | Multiple Go instances behind load balancer (sticky sessions for SSE), Redis pub/sub for SSE broadcast across instances, materialized views for common aggregations, read replicas for stats queries, separate stats database from operational database. |
| **10K+ concurrent users** | Consider WebSocket upgrade for lower latency, dedicated real-time analytics database (ClickHouse, TimescaleDB), pre-aggregation pipeline (stream processing), CDN for static assets, horizontal database sharding by company_id. |

### Scaling Priorities

1. **First bottleneck: SSE connections per server**
   - **Symptom:** High memory usage, connection timeouts
   - **Fix:** Implement Redis-backed SSE registry, distribute connections across multiple Go instances
   - **When:** 500+ concurrent SSE connections on single server

2. **Second bottleneck: Aggregation query performance**
   - **Symptom:** Slow page loads, timeouts on stats endpoints
   - **Fix:** Add daily_stats_cache table, implement hourly refresh job, use materialized views
   - **When:** Queries take >2 seconds with 100K+ call records

3. **Third bottleneck: Database write contention**
   - **Symptom:** Slow call/task inserts, lock wait timeouts
   - **Fix:** Separate read replicas for stats queries, write to primary only, consider event-driven architecture with message queue
   - **When:** 1000+ writes/minute

## Anti-Patterns to Avoid

### Anti-Pattern 1: Polling Instead of SSE

**What people do:** Frontend polls `/api/stats/aggregated` every 5 seconds

**Why it's wrong:**
- Wastes server resources (unnecessary full aggregations)
- Higher latency (up to 5 seconds before seeing updates)
- Increased database load (constant query execution)
- More complex client logic (managing intervals, avoiding race conditions)

**Do this instead:** Use SSE with smart broadcasting (push only when data changes, send deltas not full snapshots)

### Anti-Pattern 2: Client-Side Role Filtering

**What people do:** Fetch all company data, filter in JavaScript based on user role

**Why it's wrong:**
- **Security risk:** Client can inspect network traffic and see unauthorized data
- Transfers unnecessary data (bandwidth waste)
- Slower page loads (more data to transfer and process)
- Privacy violation (GDPR, HIPAA concerns)

**Do this instead:** Apply role-based WHERE clauses in SQL queries, never send unauthorized data to client

### Anti-Pattern 3: Full Chart Recreation on Update

**What people do:** Destroy and recreate Chart.js instance on every SSE update

**Why it's wrong:**
- Jarring visual experience (flickering, lost animations)
- Poor performance (Chart.js initialization is expensive)
- Loses user interactions (zoom level, tooltip state)
- Memory leaks if chart not properly destroyed

**Do this instead:** Use Chart.js `.update()` method with incremental data changes

### Anti-Pattern 4: Separate Queries Per Agent

**What people do:** Loop through agents, execute separate query for each agent's stats

**Why it's wrong:**
- N+1 query problem (10 agents = 11 database queries)
- Slow page loads (serial execution of queries)
- Database connection exhaustion (many concurrent connections)
- No transactional consistency (stats from different times)

**Do this instead:** Single aggregation query with GROUP BY agent_id, return all agents in one result set

### Anti-Pattern 5: No SSE Connection Cleanup

**What people do:** Create EventSource on page load, never call `.close()`

**Why it's wrong:**
- Memory leaks on server (orphaned connections)
- Connection limit exhaustion (6 per domain on HTTP/1.1)
- Resource waste (server keeps sending to disconnected clients)
- Error logs pollution (write errors to closed connections)

**Do this instead:** Always close EventSource in page unload handler, implement heartbeat/timeout on server

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Chart.js** | CDN or npm, initialize on canvas elements | Use v4.x (latest), supports real-time updates |
| **MySQL** | Native Go driver via database/sql | Use connection pooling, prepared statements via sqlc |
| **Session Management** | Existing cookie-based auth | Reuse existing session validation middleware |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Frontend ↔ API** | HTTP (REST) + SSE | Initial load via GET, real-time via EventSource |
| **API ↔ Database** | sqlc generated code | Type-safe queries, compile-time validation |
| **Handlers ↔ Services** | Direct function calls | Services return errors, handlers format HTTP responses |
| **SSE Broadcaster ↔ Handlers** | Go channels | Non-blocking sends with select/default, cleanup on timeout |

## Technology Recommendations

### Backend
- **SSE Library:** Native net/http (no external library needed for basic SSE)
- **Connection Registry:** In-memory map with sync.RWMutex for <100 users, Redis for production scale
- **Query Builder:** sqlc (already in use) for type-safe aggregation queries

### Frontend
- **Chart Library:** Chart.js v4.x (11KB gzipped, native vanilla JS, excellent docs)
- **Date Picker:** Native `<input type="datetime-local">` (no external dependency) or lightweight Flatpickr if advanced features needed
- **SSE Client:** Native EventSource API (built into browsers, no polyfill needed)

### Alternative Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Real-time | SSE | WebSocket | Over-engineered (don't need bidirectional), more complex |
| Charts | Chart.js | D3.js | Too complex for dashboard use case, steeper learning curve |
| Charts | Chart.js | ApexCharts | Larger bundle size (135KB vs 11KB), more features than needed |
| SSE | Native net/http | go-sse library | Adds dependency, native HTTP sufficient for this use case |

## Build Order Implications

### Phase 1: Foundation (No SSE yet)
**Build:** Basic stats page, static data fetching, Chart.js integration
**Why first:** Establishes UI patterns, validates role-based filtering, no complex concurrency

**Components:**
1. Backend: `/api/stats/aggregated` endpoint with role filtering
2. Frontend: StatsService with HTTP-only mode
3. UI: Summary cards, basic charts, time filter

### Phase 2: Real-Time (Add SSE)
**Build:** SSE endpoint, connection management, incremental updates
**Why second:** Requires stable foundation, adds complexity with connection lifecycle

**Components:**
1. Backend: `/api/stats/stream` SSE handler
2. Backend: SSEBroadcaster service with connection registry
3. Frontend: EventSource integration in StatsService
4. Frontend: Incremental chart updates

### Phase 3: Optimization (Scale)
**Build:** Caching, materialized views, export functionality
**Why third:** Performance optimizations require real usage data to prioritize

**Components:**
1. Backend: Daily stats cache table
2. Backend: Background refresh job
3. Backend: `/api/stats/export` CSV handler
4. Frontend: Export button, loading states

### Dependency Graph
```
Foundation → Real-Time → Optimization
    ↓           ↓            ↓
  (HTTP)      (SSE)      (Cache)
    ↓           ↓            ↓
Role filter ─→ Broadcast ─→ Export
    ↓
  Charts ────────────────→ Incremental updates
```

**Critical Path:** Role-based filtering must work before SSE (security-critical), Charts must work before real-time updates (visual foundation), SSE connection management must work before broadcast optimization.

## Sources

**SSE Architecture & Patterns:**
- [Why Server-Sent Events (SSE) are ideal for Real-Time Updates](https://talent500.com/blog/server-sent-events-real-time-updates/)
- [Server Sent Events | System Design](https://algomaster.io/learn/system-design/server-sent-events)
- [Using Server Sent Events to Simplify Real-time Streaming at Scale - Shopify](https://shopify.engineering/server-sent-events-data-streaming)
- [Deep Dive into Server-Sent Events (SSE)](https://dev.to/vivekyadav200988/deep-dive-into-server-sent-events-sse-4oko)

**Go + Chi Implementation:**
- [chi package - github.com/go-chi/chi](https://pkg.go.dev/github.com/go-chi/chi)
- [go-chi/chi: lightweight, idiomatic and composable router](https://github.com/go-chi/chi)
- [sseserver: High-performance Server-Sent Events endpoint for Go](https://github.com/mroth/sseserver)

**Vanilla JavaScript EventSource:**
- [Using server-sent events - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [EventSource - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [How to Implement Server-Sent Events (SSE) in React](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view) (patterns apply to vanilla JS)

**Chart Libraries:**
- [6 Best JavaScript Charting Libraries for Dashboards in 2026](https://embeddable.com/blog/javascript-charting-libraries)
- [JavaScript Chart Libraries In 2026: Best Picks](https://www.luzmo.com/blog/javascript-chart-libraries)
- [How to Build Dashboards with Chart.js: A Practical Guide](https://embeddable.com/blog/how-to-build-dashboards-with-chart-js)

**Aggregation & Query Patterns:**
- [Inside Husky's query engine: Real-time access to 100 trillion events | Datadog](https://www.datadoghq.com/blog/engineering/husky-query-architecture/)
- [Best database for real time analytics in 2026](https://www.tinybird.co/blog/best-database-for-real-time-analytics)
- [Real-time event aggregation at scale using Postgres w/ Citus](https://www.citusdata.com/blog/2016/11/29/event-aggregation-at-scale-with-postgresql/)

---
*Architecture research for: MedContact Real-Time Stats Dashboard*
*Researched: 2026-02-03*
