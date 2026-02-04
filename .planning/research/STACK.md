# Technology Stack

**Project:** MedContact Stats Dashboard
**Researched:** 2026-02-03
**Confidence:** HIGH

## Executive Summary

Adding real-time stats dashboard to existing Go 1.24 + Vanilla JS telephony PWA. Stack focuses on lightweight, framework-agnostic libraries that integrate seamlessly with existing chi router backend and Vite-bundled frontend. All recommendations prioritize simplicity over features, given the constraint of no new frameworks.

## Recommended Stack

### Frontend Charting

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| ApexCharts | 5.3.6 | Primary charting library | Best balance of features/simplicity for vanilla JS. Modern API, built-in responsiveness, excellent documentation. Works without framework. Actively maintained (last update: Dec 2025). |
| Chart.js | 4.5.1 | Alternative/complementary charting | Lighter weight option for simple charts. Excellent for basic line/bar/pie. Smaller bundle size than ApexCharts. Consider for summary cards. Active (last update: Jan 2026). |

**Recommendation:** Use ApexCharts as primary charting library. It offers 30+ chart types, mixed chart support, real-time updates API, and excellent vanilla JS integration. Chart.js remains viable for simpler visualizations if bundle size is critical.

**Confidence:** HIGH - Both libraries verified via official documentation and npm. ApexCharts specifically designed for dashboard use cases. Version numbers confirmed current as of Feb 2026.

### Backend SSE (Server-Sent Events)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| alexandrevicenzi/go-sse | Latest (stable branch) | SSE server implementation | Native chi router support with example code. Simple API, production-ready. Handles connection management, reconnection, and multiplexing. No external dependencies. |
| Standard library (fallback) | Go 1.24 | Manual SSE implementation | If go-sse is overkill, implement SSE directly with http.Flusher. Chi's net/http compatibility makes this straightforward. |

**Recommendation:** Use alexandrevicenzi/go-sse unless you need absolute minimal dependencies. The library provides proper SSE spec compliance (Content-Type, heartbeats, reconnection) without boilerplate. Has chi-specific examples.

**Installation:**
```bash
go get github.com/alexandrevicenzi/go-sse
```

**Integration pattern:**
```go
import (
    "github.com/alexandrevicenzi/go-sse"
    "github.com/go-chi/chi/v5"
)

s := sse.NewServer(nil)
defer s.Shutdown()

r := chi.NewRouter()
r.Mount("/events/", s)  // SSE endpoint

// Send updates
s.SendMessage("/events/stats", sse.SimpleMessage("update"))
```

**Confidence:** HIGH - Verified via GitHub examples and Go Forum discussions. Library specifically designed for chi router integration.

### Database Aggregation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| database/sql | Go 1.24 stdlib | Connection pooling | Already in use. SetMaxOpenConns(25), SetMaxIdleConns(25), SetConnMaxLifetime(5*time.Minute) recommended for dashboard queries. |
| sqlc | Current | Query generation | Already in project. Use for aggregation queries with proper GROUP BY clauses. Type-safe, generates Go code from SQL. |
| MySQL 8.0+ | 8.0+ | Database | Supports window functions, CTEs for complex aggregations. No materialized views needed for this scale. |

**Query pattern:** Pre-aggregate in SQL using SUM, COUNT, AVG with GROUP BY user_id, date ranges. Return aggregated results to backend, not raw records.

**Example aggregation pattern:**
```sql
-- sqlc query for call stats by agent
-- name: GetCallStatsByAgent :many
SELECT
    u.id,
    u.name,
    COUNT(c.id) as total_calls,
    SUM(c.duration) as total_duration,
    SUM(CASE WHEN c.status = 'answered' THEN 1 ELSE 0 END) as answered_calls,
    DATE(c.created_at) as call_date
FROM users u
LEFT JOIN calls c ON c.user_id = u.id
WHERE u.manager_id = $1
  AND c.created_at BETWEEN $2 AND $3
GROUP BY u.id, u.name, DATE(c.created_at)
ORDER BY call_date DESC, u.name;
```

**Connection pooling best practice:**
```go
db.SetMaxOpenConns(25)           // Limit total connections
db.SetMaxIdleConns(25)           // Keep connections warm
db.SetConnMaxLifetime(5*time.Minute)  // Rotate before MySQL timeout
```

**Confidence:** HIGH - MySQL aggregation patterns well-established. Connection pooling settings from official Go database/sql documentation and MySQL driver maintainers.

### CSV/Excel Export

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| SheetJS (xlsx) | Latest from CDN | Excel export (client-side) | Industry standard. Handles XLSX, CSV, and other formats. Client-side processing = no server load. |
| PapaParse | 5.x (verify npm) | CSV export/parsing | Simpler alternative for CSV-only. Fastest in-browser CSV parser. RFC 4180 compliant. Zero dependencies. |

**Recommendation:** Use SheetJS for full-featured export (XLSX + CSV). Use PapaParse if CSV-only is acceptable and you want smaller bundle size.

**Important note on SheetJS versions:** npm registry (0.18.5) is outdated. Install from CDN:

```bash
npm install https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz
```

**Client-side export pattern (SheetJS):**
```javascript
import * as XLSX from 'xlsx';

function exportToExcel(data, filename) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stats");
    XLSX.writeFile(wb, `${filename}.xlsx`);
}
```

**Client-side CSV (PapaParse):**
```javascript
import Papa from 'papaparse';

function exportToCSV(data, filename) {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
}
```

**Confidence:** MEDIUM-HIGH - SheetJS CDN distribution verified via official docs. PapaParse version and features verified via npm and multiple sources. Both widely used in production.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| go-chi/cors | v1.x | CORS middleware | Required for SSE if frontend served from different origin. Standard chi middleware. |
| file-saver | 2.x | Client-side file download | If not using SheetJS writeFile. Handles browser compatibility for downloads. |
| date-fns | 3.x | Date formatting | Consider for consistent date formatting in frontend. Lighter than moment.js. Tree-shakeable. |

## Existing Stack (Preserved)

These are already in the project and should be used consistently:

| Technology | Purpose | Notes |
|------------|---------|-------|
| Go 1.24 | Backend runtime | Keep existing version |
| chi router | HTTP routing | v5.x already in use |
| MySQL | Database | Version unknown, assume 8.0+ |
| sqlc | Query generation | Already configured |
| Vanilla JS | Frontend logic | No frameworks constraint |
| Vite | Frontend bundler | Already configured |
| Tailwind CSS | Styling | Maintain consistency |

## Installation Commands

```bash
# Backend
go get github.com/alexandrevicenzi/go-sse
go get github.com/go-chi/cors

# Frontend
npm install https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz
npm install apexcharts
npm install papaparse  # If using CSV instead of/alongside SheetJS
npm install date-fns   # Optional, for date formatting

# Dev dependencies (none required for this milestone)
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Charting | ApexCharts | Chart.js | ApexCharts has better out-of-box dashboard features (mixed charts, annotations, real-time updates). Chart.js is simpler but requires more manual work for dashboards. Keep Chart.js as fallback. |
| Charting | ApexCharts | Apache ECharts | ECharts is more powerful but has steeper learning curve and larger bundle. Overkill for this use case. |
| Charting | ApexCharts | D3.js | D3 requires significant custom code for basic charts. Too low-level for time-constrained dashboard work. |
| SSE Library | go-sse | Standard library | Standard library SSE is viable but requires manual connection management, heartbeats, reconnection logic. go-sse provides this. |
| SSE Library | go-sse | tmaxmax/go-sse | Newer library, fewer production examples. Requires Go 1.22+ with GOEXPERIMENT flag. alexandrevicenzi/go-sse is more mature. |
| CSV/Excel | SheetJS | exceljs | exceljs is Node-focused, heavier. SheetJS is battle-tested in browsers. |
| CSV | PapaParse | csv-parse | csv-parse is Node-focused. PapaParse is specifically optimized for browser use. |
| Database aggregation | SQL GROUP BY | Materialized views | MySQL doesn't have native materialized views. Manual refresh with triggers/events adds complexity. SQL aggregation is simpler for this scale. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| WebSocket | Two-way communication not needed. SSE is simpler for one-way server→client updates. Adds unnecessary complexity. | SSE (alexandrevicenzi/go-sse) |
| React/Vue/Angular wrappers | Project constraint: Vanilla JS only. Framework wrappers add bundle size without benefit. | ApexCharts vanilla JS API |
| Moment.js | Deprecated, large bundle size (67KB). No longer maintained. | date-fns (smaller, tree-shakeable) or Intl.DateTimeFormat (native) |
| jQuery | Legacy library, not needed with modern browser APIs. Adds 30KB for no benefit. | Native DOM APIs (querySelector, fetch, etc.) |
| npm xlsx package (0.18.5) | Outdated by 2+ years. Official distribution is now CDN-only. | SheetJS from cdn.sheetjs.com |
| Server-side CSV generation | Wastes server resources. CSV generation is trivial in browser. | PapaParse or SheetJS client-side |
| Database connection per request | Will exhaust MySQL connections under load. | Connection pooling (database/sql with proper SetMaxOpenConns) |
| Fetching raw records for aggregation | Kills performance. Sends too much data to client. | SQL aggregation (GROUP BY, SUM, COUNT, AVG) |

## Stack Patterns by Use Case

### Real-time Update Flow

**Backend (Go + chi + go-sse):**
1. Client connects to `/events/stats` endpoint
2. Backend sends periodic updates via SSE (every 5-10 seconds)
3. On data change (new call logged), trigger immediate SSE update
4. Include only changed metrics, not full dataset

**Frontend (Vanilla JS + ApexCharts):**
1. EventSource connects to `/events/stats`
2. On message, parse JSON stats update
3. Call `chart.updateSeries([{data: newData}])` for real-time chart update
4. No page reload, no polling

### Export Flow

**Client-side processing:**
1. User clicks "Export to Excel" button
2. JavaScript fetches current displayed data (already aggregated)
3. SheetJS converts JSON → XLSX in browser
4. Browser downloads file directly
5. No server involvement = no server load

### Aggregation Query Flow

**Database → Backend → Frontend:**
1. Frontend requests stats with filters (date range, user IDs)
2. Backend constructs sqlc query with WHERE + GROUP BY
3. MySQL returns aggregated rows (not thousands of raw records)
4. Backend formats as JSON, sends to frontend
5. Frontend receives ready-to-display data

## Version Compatibility Matrix

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| ApexCharts | 5.3.6 | Modern browsers (ES6+) | No IE11 support needed for PWA |
| Chart.js | 4.5.1 | Modern browsers (ES6+) | No IE11 support in v4 |
| SheetJS | Latest (CDN) | All browsers | Check CDN for exact version |
| go-sse | Latest stable | chi v3-v5, Go 1.16+ | Works with existing chi router |
| go-chi/cors | v1.x | chi v5 | Match chi version |
| PapaParse | 5.x | All browsers | RFC 4180 compliant |

## Performance Considerations

### Charting Library Bundle Sizes

| Library | Minified | Gzipped | Impact |
|---------|----------|---------|--------|
| ApexCharts | ~450KB | ~130KB | Moderate. Use code splitting to lazy-load on stats page only. |
| Chart.js | ~200KB | ~60KB | Small. Can load eagerly if used elsewhere. |
| PapaParse | ~135KB | ~42KB | Small. Load on-demand when export clicked. |
| SheetJS | ~800KB | ~240KB | Large. Definitely lazy-load on export action. |

**Recommendation:** Lazy-load SheetJS and charting libraries only on stats page. Use dynamic import:

```javascript
// Load ApexCharts only when stats page loads
const loadCharts = async () => {
    const ApexCharts = await import('apexcharts');
    return ApexCharts.default;
};
```

### Database Query Performance

**Expected scale (from PROJECT.md context):**
- Call center application, likely <1000 agents per company
- Stats aggregated per day/week/month = manageable result sets
- GROUP BY with date ranges returns 10s-100s rows, not thousands

**Optimization strategy:**
1. Add composite indexes: `(user_id, created_at)` on calls/tasks tables
2. Use date range filters to limit scans: `WHERE created_at BETWEEN ? AND ?`
3. Pre-aggregate by day in SQL, not in application code
4. Connection pooling prevents connection exhaustion

### SSE Connection Limits

**Browser limit:** Most browsers limit to 6 concurrent SSE connections per domain.

**Mitigation:** Use single SSE connection for all stats updates. Multiplex different stat types over one connection:

```javascript
eventSource.addEventListener('call-stats', (e) => {
    updateCallCharts(JSON.parse(e.data));
});

eventSource.addEventListener('task-stats', (e) => {
    updateTaskCharts(JSON.parse(e.data));
});
```

## Security Considerations

### SSE Authentication

SSE uses standard HTTP, so existing session cookies work. Ensure:
1. SSE endpoint validates session before allowing connection
2. Role-based filtering applied at query level (manager sees only their reports)
3. Close SSE connections on session expiration

### CORS Configuration

If SSE crosses origins (unlikely in PWA), configure go-chi/cors:

```go
import "github.com/go-chi/cors"

r.Use(cors.Handler(cors.Options{
    AllowedOrigins:   []string{"https://app.medcontact.com"},
    AllowedMethods:   []string{"GET", "OPTIONS"},
    AllowCredentials: true,
}))
```

### Export Security

Client-side export is safe because:
1. Data already authorized (user can only see what they're allowed)
2. No file upload attack surface
3. Generated files contain only what's displayed

## Migration from Current State

### Backend Changes

1. Add SSE library: `go get github.com/alexandrevicenzi/go-sse`
2. Create SSE endpoint: `/api/stats/stream` or `/events/stats`
3. Write aggregation queries in sqlc for team stats
4. Add role-based filtering to queries (existing user context)

### Frontend Changes

1. Install charting library: `npm install apexcharts`
2. Create stats page component (follow existing dashboard-home.js pattern)
3. Initialize EventSource for SSE connection
4. Add export functionality (lazy-load SheetJS)
5. Add route in existing router for stats page

### No Breaking Changes

This is purely additive. Existing endpoints and functionality untouched.

## Sources

### Charting Libraries
- [ApexCharts Official](https://apexcharts.com/) — Verified version, vanilla JS support, features (HIGH confidence)
- [Chart.js Official](https://www.chartjs.org/) — Verified v4.5.1, HTML5 Canvas rendering (HIGH confidence)
- [JavaScript Charting Libraries for Dashboards 2026](https://embeddable.com/blog/javascript-charting-libraries) — Ecosystem overview (MEDIUM confidence)
- [JavaScript Chart Libraries Comparison 2026](https://www.luzmo.com/blog/javascript-chart-libraries) — Performance and feature comparison (MEDIUM confidence)
- [npm-compare: ApexCharts vs Chart.js vs ECharts](https://npm-compare.com/apexcharts,chart.js,echarts,recharts) — Popularity and maintenance status (MEDIUM confidence)

### Server-Sent Events (SSE)
- [go-sse chi.go example](https://github.com/alexandrevicenzi/go-sse/blob/master/_examples/chi.go) — Chi router integration (HIGH confidence)
- [alexandrevicenzi/go-sse GitHub](https://github.com/alexandrevicenzi/go-sse) — Library features and API (HIGH confidence)
- [Go Forum: SSE on go-chi router](https://forum.golangbridge.org/t/sse-on-go-chi-router/15294) — Community validation (MEDIUM confidence)
- [Server-Sent Events in Go](https://thedevelopercafe.com/articles/server-sent-events-in-go-595ae2740c7a) — Implementation patterns (MEDIUM confidence)

### Database & Connection Pooling
- [Go database/sql: Managing Connections](https://go.dev/doc/database/manage-connections) — Official Go docs for SetMaxOpenConns (HIGH confidence)
- [Configuring sql.DB for Better Performance](https://www.alexedwards.net/blog/configuring-sqldb) — Connection pool best practices (HIGH confidence)
- [MySQL Connection Pooling in Go](https://medium.com/propertyfinder-engineering/go-and-mysql-setting-up-connection-pooling-4b778ef8e560) — MySQL-specific recommendations (MEDIUM confidence)
- [How to Build Real-Time Dashboards](https://estuary.dev/blog/how-to-build-a-real-time-dashboard/) — Architecture patterns for real-time aggregation (MEDIUM confidence)
- [MySQL HeatWave Auto-Refresh Materialized Views](https://blogs.oracle.com/mysql/realtime-analytics-with-mysql-heatwave-autorefresh-materialized-views) — Modern MySQL features for analytics (MEDIUM confidence)

### CSV/Excel Export
- [SheetJS CDN Distribution](https://cdn.sheetjs.com/xlsx/) — Official distribution method (HIGH confidence)
- [SheetJS npm package](https://www.npmjs.com/package/xlsx) — Version info and outdated npm warning (HIGH confidence)
- [PapaParse Official](https://www.papaparse.com/) — CSV parsing and generation (HIGH confidence)
- [JavaScript CSV Parsers Comparison](https://leanylabs.com/blog/js-csv-parsers-benchmarks/) — Performance benchmarks (MEDIUM confidence)
- [Top 5 JavaScript CSV Parsers](https://www.oneschema.co/blog/top-5-javascript-csv-parsers) — Ecosystem overview (MEDIUM confidence)

### Chi Router & Middleware
- [go-chi/chi GitHub](https://github.com/go-chi/chi) — Official repository (HIGH confidence)
- [go-chi/cors GitHub](https://github.com/go-chi/cors) — CORS middleware (HIGH confidence)
- [chi/v5 package documentation](https://pkg.go.dev/github.com/go-chi/chi/v5) — API documentation (HIGH confidence)

---

*Stack research for: MedContact Stats Dashboard*
*Researched: 2026-02-03*
*Confidence: HIGH for all primary recommendations, MEDIUM for alternatives*
