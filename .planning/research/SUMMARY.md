# Project Research Summary

**Project:** MedContact Stats Dashboard
**Domain:** Real-time call center supervisor performance dashboard
**Researched:** 2026-02-03
**Confidence:** MEDIUM-HIGH

## Executive Summary

This project adds a real-time statistics dashboard to an existing Go 1.24 + Vanilla JS telephony PWA for call center supervisors. Expert research reveals this is a well-established domain with clear patterns: use Server-Sent Events (SSE) for real-time updates, pre-aggregate statistics at the database layer, and enforce role-based access control server-side. The recommended stack is deliberately conservative—ApexCharts for visualization, alexandrevicenzi/go-sse for server push, sqlc for type-safe aggregation queries—all chosen to integrate seamlessly with the existing chi router backend and Vite-bundled frontend without introducing new frameworks.

The primary risk is SSE connection management. Improperly handled connections lead to memory leaks that can grow a dashboard from 40MB to over 1GB in production, ultimately crashing browsers. The second critical risk is role-based access control bypass—94% of applications fail this (OWASP Top 10 #1). Client-side role filtering is unacceptable; all visibility rules must be enforced in SQL queries. Database query performance is the third major concern; N+1 patterns and missing indexes cause sub-second queries to degrade into 10+ second nightmares at scale.

The recommended approach is to build conservatively in phases: establish SSE infrastructure with proper cleanup first, implement role-filtered aggregation queries second, add chart visualizations third. Skip real-time alerts, sentiment analysis, and predictive analytics for v2+. The dashboard is table stakes for call center management software—supervisors expect real-time metrics, agent status visibility, time period filtering, and basic CSV export at minimum. Differentiators like trend charts and performance comparisons can wait until the core is validated.

## Key Findings

### Recommended Stack

Research strongly recommends ApexCharts (5.3.6) as the primary charting library. It offers 30+ chart types, mixed chart support, real-time update API, and excellent vanilla JS integration. While Chart.js (4.5.1) is lighter weight, ApexCharts provides better out-of-box dashboard features. Both are actively maintained with releases in December 2025 and January 2026 respectively.

**Core technologies:**
- **ApexCharts 5.3.6**: Primary charting library — best balance of features and simplicity for vanilla JS, built-in responsiveness, modern API
- **alexandrevicenzi/go-sse**: SSE server implementation — native chi router support with example code, handles connection management and multiplexing
- **sqlc**: Query generation (already in use) — type-safe aggregation queries with GROUP BY clauses, generates Go code from SQL
- **SheetJS (CDN)**: Excel/CSV export — industry standard for client-side processing, zero server load
- **MySQL 8.0+**: Database (existing) — supports window functions and CTEs for complex aggregations

**Key version notes:**
- SheetJS npm registry (0.18.5) is outdated; install from CDN: `npm install https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`
- go-sse requires Go 1.16+ and works with chi v3-v5
- ApexCharts requires ES6+ browsers (no IE11 support needed for PWA)

**Existing stack to preserve:**
- Go 1.24 backend runtime with chi v5 router
- MySQL database with sqlc query generation
- Vanilla JS frontend bundled with Vite
- Tailwind CSS for styling consistency

### Expected Features

Research identifies clear feature hierarchy based on 2026 industry standards. Real-time metrics display is table stakes—supervisors have expected instant visibility since 2020. Role-based access control is both a security requirement and usability need in multi-tenant environments. Time period filtering (today, week, month) is universal across all vendor implementations.

**Must have (table stakes):**
- **Real-time metrics display** — industry standard, supervisors need instant visibility (5-30 second refresh typical)
- **Summary cards (KPI overview)** — 4-6 key metrics: total calls, active agents, avg handle time, tasks completed
- **Agent status visibility** — who's available/busy/offline right now (core supervisor need for workload management)
- **Role-based access control** — admin sees all companies, manager sees reports, support sees assigned companies
- **Time period filtering** — today, yesterday, this week, this month (presets, custom date range is v1.2)
- **Basic call statistics** — call volume, duration, completion rates (operational metrics every supervisor needs)
- **CSV export** — regulatory/compliance requirement in many industries

**Should have (competitive advantage):**
- **Trend visualization (charts)** — line charts for time-series, bar charts for comparisons (faster pattern recognition than tables)
- **Historical trend comparison** — this week vs last week, month-over-month (helps identify performance changes)
- **Agent performance rankings** — top performers, coaching targets (must handle sensitivity)
- **Real-time alert system** — proactive detection of SLA breaches, queue spikes, idle time thresholds
- **Mobile-responsive design** — 2026 expectation for management tools, supervisors monitor from anywhere

**Defer (v2+):**
- **Sentiment analysis** — AI-powered customer satisfaction prediction (emerging 2026 feature, requires ML infrastructure)
- **Predictive analytics** — forecast call volumes and staffing needs (needs 3-6 months historical data, ML expertise)
- **Call monitoring integration** — listen to live calls from dashboard (requires deep PBX integration)
- **Multi-channel tracking** — calls + chat + email unified (complex integration with multiple systems)
- **Custom dashboard layouts** — user-configurable widget placement (complex state management)

**Anti-features (avoid):**
- Real-time updates every second (creates server load, battery drain, visual noise—10-30 seconds sufficient)
- Display all metrics simultaneously (overwhelms users, obscures signals—show 5-8 key metrics with drill-down)
- Agent-level real-time screenshots (privacy violations, trust erosion, legal risks)
- Public performance leaderboards (toxic culture, demotivates bottom performers—use private views)

### Architecture Approach

The recommended architecture uses Server-Sent Events (SSE) for unidirectional server-to-client push, role-based filtering at the SQL query level, and client-side chart libraries with incremental updates. This is a standard pattern for real-time dashboards at 0-100 concurrent users requiring no caching or distributed infrastructure.

**Major components:**
1. **SSE Handler** — maintains persistent HTTP connections, pushes updates on data changes, includes heartbeat for keepalive
2. **Stats Aggregator** — builds sqlc queries with role-based WHERE clauses, pre-aggregates using SQL GROUP BY/SUM/COUNT
3. **Role-Based Filter** — applies visibility rules at query level (admin→company, manager→reports, support→all)
4. **StatsService (frontend)** — manages EventSource lifecycle, state management, notifies chart components of updates
5. **Chart Components** — renders ApexCharts with incremental `.update()` calls, no chart recreation

**Key architectural patterns:**
- **SSE for real-time** — simpler than WebSocket (unidirectional only), automatic browser reconnection, works through proxies
- **Role filtering in SQL** — security enforced at database layer, better performance, single source of truth
- **Incremental chart updates** — call `chart.updateSeries()` instead of recreating, smooth animations, maintains user interactions
- **Client-side export** — SheetJS processes JSON→XLSX in browser, zero server load

**Data flow:**
1. Frontend requests initial stats via GET `/api/stats/aggregated?time=today`
2. Backend determines user role from session, applies role-based WHERE clause
3. MySQL returns aggregated rows (not raw records), backend formats as JSON
4. Frontend renders charts, then opens EventSource to `/api/stats/stream`
5. On data change (new call logged), SSE Broadcaster pushes delta update
6. Frontend receives update, calls `chart.updateSeries()` for smooth update

**Scaling:** Single Go server with direct MySQL queries sufficient for 0-100 concurrent users. At 100-1K users, add Redis for SSE connection registry and implement daily stats cache table. At 1K-10K, use multiple Go instances with load balancer, Redis pub/sub for SSE broadcast, and read replicas for stats queries.

### Critical Pitfalls

Research identifies six critical pitfalls with concrete prevention strategies. These are domain-specific issues beyond general web development best practices.

1. **SSE Connection Leaks and Memory Exhaustion** — EventSource connections never properly closed lead to zombie connections that accumulate. Memory grows from 40MB to 1GB+ in production, crashing browsers. Always call `eventSource.close()` on page unload, implement connection timeouts, use heartbeat pings to detect stale connections server-side. Address in Phase 1 (SSE Infrastructure).

2. **Database Query Performance Collapse** — N+1 query patterns emerge where dashboard executes one query per metric/user. 100ms page load transforms into 10+ second nightmare. Pre-aggregate statistics into summary tables, create materialized views, index ALL columns in WHERE/JOIN/GROUP BY clauses. Test with 10x expected production data volume. Address in Phase 2 (Core Stats Queries).

3. **Role-Based Access Control Bypass** — Backend sends all data, relying on JavaScript to filter by role. OWASP Top 10 #1 vulnerability affecting 94% of applications. Always enforce role checks server-side for every API endpoint, filter data in SQL using role_id before sending to client, never trust client-provided role data. Address in Phase 3 (Role Filtering).

4. **Chart Library Memory Leaks** — Chart instances created repeatedly without destroying old ones. Memory grows unbounded as Chart.js keeps references to destroyed DOM elements. Store chart instance in variable, call `chartInstance.destroy()` before creating new chart, use `chartInstance.update()` to modify data instead of recreation. Address in Phase 4 (Chart Integration).

5. **Timezone Confusion** — Date filters show wrong data because of UTC/local timezone mismatches. "Today's stats" shows yesterday's data for users in certain timezones. Store ALL timestamps in UTC (use TIMESTAMPTZ), send ISO 8601 strings with timezone in API, convert to user timezone only for display. Test with UTC-12 and UTC+12 system timezones. Address in Phase 2 (Core Stats Queries).

6. **Proxy/Load Balancer Breaking SSE** — SSE works in development but fails in production. Events arrive in batches after long delays instead of streaming. Proxies buffer responses without recognizing `Content-Type: text/event-stream`. Set `X-Accel-Buffering: no` header for Nginx, configure load balancer to recognize SSE, use HTTP/2 for better streaming. Test through production-like infrastructure early. Address in Phase 1 (SSE Infrastructure).

## Implications for Roadmap

Based on research, the suggested phase structure follows a conservative build order that addresses critical pitfalls early and defers advanced features until the foundation is validated.

### Phase 1: SSE Infrastructure & Foundation
**Rationale:** SSE connection management is the highest-risk component. Build it first with proper cleanup, connection limits, and heartbeat keepalive to avoid memory leak disasters in production. Proxy/load balancer compatibility must be verified before building dependent features.

**Delivers:**
- SSE endpoint (`/api/stats/stream`) with go-sse library
- Connection registry and lifecycle management
- Heartbeat pings and auto-reconnection logic
- Frontend EventSource integration with cleanup handlers
- Test harness for 4-hour memory leak verification

**Addresses:**
- Pitfall #1 (SSE connection leaks)
- Pitfall #6 (proxy buffering)

**Stack elements:** alexandrevicenzi/go-sse, chi router, native EventSource API

**Research flag:** Standard pattern—well-documented in go-sse examples and MDN. Skip research-phase.

### Phase 2: Role-Filtered Aggregation Queries
**Rationale:** Security-critical foundation. Role-based access control must be enforced at SQL query level before building any UI that displays data. Database query performance patterns (indexes, aggregation, timezone handling) are established here and reused by all subsequent phases.

**Delivers:**
- sqlc queries with role-based WHERE clauses (admin/manager/support scopes)
- Database indexes on (user_id, created_at) composite keys
- Aggregation queries using GROUP BY/SUM/COUNT for call/task statistics
- GET `/api/stats/aggregated` endpoint with time period filtering
- UTC timezone handling convention and TIMESTAMPTZ storage
- Query performance tests with 10k+ records

**Addresses:**
- Pitfall #3 (role-based access bypass)
- Pitfall #2 (database query performance)
- Pitfall #5 (timezone confusion)

**Features:** Role-based access control, time period filtering (presets), basic call statistics

**Research flag:** Standard SQL patterns—role filtering examples available. Skip research-phase.

### Phase 3: Summary Cards & Basic Dashboard UI
**Rationale:** Establish UI patterns and validate role filtering works correctly before adding chart complexity. Summary cards are table stakes and lowest-risk frontend component. This phase validates the data pipeline end-to-end without charting library dependencies.

**Delivers:**
- Stats page component following existing dashboard-home.js pattern
- StatsService for state management and API orchestration
- 4-6 summary cards (total calls, active agents, avg handle time, tasks completed, answered calls, service level)
- Time range filter component (today, yesterday, this week, this month)
- Scope filter component (company/agent selector based on role)
- Responsive layout with Tailwind CSS

**Addresses:**
- Feature: Summary cards (KPI overview)
- Feature: Time period filtering UI
- Feature: Responsive design
- UX pitfall: No loading states (add skeleton screens)

**Features:** Summary cards, agent status table, time period selector

**Research flag:** Standard dashboard UI patterns. Skip research-phase.

### Phase 4: Chart Visualization Integration
**Rationale:** Chart libraries introduce memory management complexity. Build on stable data foundation from Phase 2-3. Chart lifecycle management (create once, update incrementally) prevents memory leaks that plague most real-time dashboards.

**Delivers:**
- ApexCharts integration with lazy loading (dynamic import)
- Chart components with proper instance management
- Incremental update logic using `chart.updateSeries()`
- Line charts for call volume trends over time
- Bar charts for agent performance comparison
- Real-time chart updates via SSE integration
- Memory leak prevention with destroy/update cycle

**Addresses:**
- Pitfall #4 (chart memory leaks)
- Feature: Trend visualization
- UX pitfall: Chart flickering (use incremental updates)

**Stack elements:** ApexCharts 5.3.6, Chart.js fallback option

**Research flag:** Standard Chart.js/ApexCharts patterns. Skip research-phase.

### Phase 5: Data Export & Historical Analysis
**Rationale:** Export functionality depends on existing data tables from Phase 3. Client-side processing with SheetJS eliminates server load. Historical trend comparison uses existing aggregation queries with different date parameters.

**Delivers:**
- SheetJS integration (lazy-loaded on export button click)
- CSV export handler with PapaParse
- Excel export with XLSX format support
- Custom date range picker (beyond presets)
- Historical trend comparison (this week vs last week)
- Agent performance metrics (login time, detailed breakdown)

**Addresses:**
- Feature: CSV export (compliance requirement)
- Feature: Custom date range
- Feature: Historical trend comparison
- Feature: Agent performance metrics

**Stack elements:** SheetJS (CDN), PapaParse 5.x, date-fns

**Research flag:** Standard export patterns. Skip research-phase.

### Phase 6: Real-Time Optimization & Polish
**Rationale:** Performance optimizations require real usage data to prioritize. This phase adds caching, materialized views, and UX refinements discovered during user testing. Defer until foundation is validated in production.

**Delivers:**
- Daily stats cache table (materialized view pattern)
- Background refresh job for cache updates
- Query result caching (30-60 second TTL)
- Connection limits and rate limiting per user
- Offline indicator for SSE disconnection
- Update rate limiting (buffer updates every 2-5 seconds)
- Timezone indicator display ("Times shown in PST")

**Addresses:**
- Pitfall #2 (query performance at scale)
- UX pitfall: No offline indicator
- UX pitfall: Auto-updating without warning

**Research flag:** Standard optimization patterns. Skip research-phase.

### Phase Ordering Rationale

**Security first:** Role-based access control (Phase 2) must be bulletproof before building UI. This is non-negotiable—94% of applications fail this test.

**Risk reduction:** SSE connection management (Phase 1) is the highest-risk component with the most production failures. Build it first when complexity is lowest. Memory leak prevention must be baked in from day one, not retrofitted.

**Foundation before features:** Establish aggregation query patterns and timezone handling (Phase 2) before building dependent UI (Phase 3-5). This prevents architectural rework when adding features.

**Progressive enhancement:** Start with simple summary cards (Phase 3), add chart complexity (Phase 4), then export/analysis (Phase 5). Each phase validates the previous foundation before adding new capabilities.

**Defer optimization:** Caching and materialized views (Phase 6) require real usage data to prioritize. Build when foundation is validated, not prematurely.

**Defer advanced features:** Real-time alerts, sentiment analysis, predictive analytics, and call monitoring are v2+ features. They require additional infrastructure (ML, PBX integration) and distract from core supervisor needs.

### Research Flags

**All phases use standard patterns (skip research-phase):**
- Phase 1: go-sse library has chi router examples in GitHub
- Phase 2: SQL aggregation and role filtering are well-established patterns
- Phase 3: Dashboard UI follows existing project patterns (dashboard-home.js)
- Phase 4: Chart.js/ApexCharts documentation is comprehensive with real-time examples
- Phase 5: SheetJS and PapaParse have extensive client-side export examples
- Phase 6: Caching and materialized views are standard MySQL optimization patterns

**No phases require /gsd:research-phase.** All technology choices are mature with extensive documentation and community examples. The domain (call center dashboards) is well-established with clear best practices from multiple vendors.

**Validation approach:** Each phase includes specific verification criteria tied to pitfall prevention (e.g., "run dashboard 4 hours, memory stays under 200MB"). Testing with production-scale data (10k+ records) happens in Phase 2 to catch performance issues early.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified via official documentation and npm. Version numbers confirmed current as of Feb 2026. ApexCharts, Chart.js, go-sse, and SheetJS have extensive production usage. |
| Features | MEDIUM | Based on industry best practices and multiple vendor implementations (2026 call center dashboard research). Confidence is MEDIUM because findings are primarily from vendor documentation and industry blogs rather than academic research. |
| Architecture | HIGH | SSE patterns verified via MDN, Shopify Engineering blog, and production examples. sqlc query generation and chi router integration have official documentation. Scaling recommendations based on established patterns. |
| Pitfalls | MEDIUM | Based on verified WebSearch findings from recent sources (2025-2026), corroborated across multiple authoritative sources. Memory leak issues have GitHub issue verification. Not all verified against official documentation for every technology. |

**Overall confidence:** MEDIUM-HIGH

The stack and architecture recommendations are highly confident—mature technologies with extensive documentation and production validation. Feature prioritization is solid but contextual to 2026 call center industry standards. Pitfall identification is thorough and well-sourced, though some details require validation during implementation.

### Gaps to Address

**Connection pooling configuration:** Research recommends `SetMaxOpenConns(25)` but optimal values depend on actual load patterns. Monitor connection usage in production and adjust based on metrics.

**SSE browser connection limits:** HTTP/1.1 limits to 6 concurrent SSE connections per domain, HTTP/2 allows 100+. Verify production infrastructure uses HTTP/2 or implement connection multiplexing early.

**Optimal refresh rate for real-time updates:** Research suggests 10-30 seconds, but user preferences may vary. Implement as configurable parameter and gather feedback during user testing.

**Chart data point limits:** Research suggests limiting to 50 visible points, but this depends on screen size and chart density. Test with actual dashboard layouts and adjust based on performance profiling.

**Materialized view refresh frequency:** Research suggests hourly refresh for daily_stats_cache, but optimal frequency depends on data volume and query load. Start conservative (hourly) and optimize based on monitoring.

**Date range limits for query performance:** Research suggests limiting to 90 days, but acceptable range depends on data volume and query complexity. Implement progressive limits (7/30/90 days) and measure query performance at each tier.

## Sources

### Primary (HIGH confidence)
- [ApexCharts Official Documentation](https://apexcharts.com/) — charting library features, vanilla JS integration, version verification
- [Chart.js Official Documentation](https://www.chartjs.org/) — v4.5.1 features, performance optimization, incremental updates
- [go-sse GitHub Repository](https://github.com/alexandrevicenzi/go-sse) — chi router integration examples, API documentation
- [MDN Web Docs: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) — EventSource API, browser compatibility
- [SheetJS CDN Distribution](https://cdn.sheetjs.com/xlsx/) — official distribution method, version info
- [Go database/sql Documentation](https://go.dev/doc/database/manage-connections) — connection pooling best practices
- [OWASP Top 10: Broken Access Control](https://www.securityjourney.com/post/owasp-top-10-broken-access-control-explained) — security vulnerability patterns

### Secondary (MEDIUM confidence)
- [Top 8 Call Center Dashboard Software Providers in 2026](https://voiso.com/articles/top-8-call-center-dashboards/) — feature expectations, industry standards
- [The Hidden Risks of SSE: What Developers Often Overlook](https://medium.com/@2957607810/the-hidden-risks-of-sse-server-sent-events-what-developers-often-overlook-14221a4b3bfe) — connection leak pitfalls
- [Shopify Engineering: Server-Sent Events at Scale](https://shopify.engineering/server-sent-events-data-streaming) — production SSE patterns
- [Chart.js Performance Documentation](https://www.chartjs.org/docs/latest/general/performance.html) — memory optimization
- [Contact Center Dashboards: The Ultimate Guide](https://www.computer-talk.com/blogs/contact-center-dashboards--the-ultimate-guide) — feature prioritization
- [From Data To Decisions: UX Strategies For Real-Time Dashboards](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/) — UX best practices

### Tertiary (LOW confidence)
- [JavaScript Charting Libraries for Dashboards 2026](https://embeddable.com/blog/javascript-charting-libraries) — ecosystem overview, comparison
- [npm-compare: ApexCharts vs Chart.js](https://npm-compare.com/apexcharts,chart.js) — popularity metrics
- Various vendor blogs and implementation guides cited in individual research files

---
*Research completed: 2026-02-03*
*Ready for roadmap: yes*
