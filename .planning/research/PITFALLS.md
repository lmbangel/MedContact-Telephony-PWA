# Pitfalls Research

**Domain:** Real-time Stats Dashboards with SSE
**Researched:** 2026-02-03
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: SSE Connection Leaks and Memory Exhaustion

**What goes wrong:**
SSE connections are never properly closed, leading to zombie connections that accumulate over time. Memory consumption grows continuously, eventually causing browser crashes or server resource exhaustion. In production, dashboards can grow from 40MB to over 1GB of memory after hours of running.

**Why it happens:**
Developers create EventSource connections but forget to implement cleanup, particularly when components unmount or users navigate away. In React/vanilla JS, missing cleanup in lifecycle hooks leaves connections open. Additionally, when users trigger dashboard refreshes, new connections are created without terminating old ones.

**How to avoid:**
- ALWAYS call `eventSource.close()` when disconnecting
- In vanilla JS, track EventSource instances and close them on page unload/navigation
- Implement connection timeouts and auto-reconnection with backoff
- Use heartbeat pings to detect stale connections server-side and close them
- Monitor connection count per user/session and enforce limits

**Warning signs:**
- Browser memory usage continuously climbing over time
- DevTools Network tab shows multiple EventSource connections to same endpoint
- Server connection count grows without corresponding user increase
- Dashboard becomes sluggish after 30+ minutes of runtime
- Browser tab crashes after several hours

**Phase to address:**
Phase 1 (SSE Infrastructure) - Build connection management from day one. Include cleanup handlers and connection pooling in initial implementation, not as afterthought.

---

### Pitfall 2: Database Query Performance Collapse Under Load

**What goes wrong:**
Dashboard queries work fine with 100 records but become unusable at scale. N+1 query patterns emerge where the dashboard executes one query per metric or user, creating hundreds of database calls. A 100ms page load transforms into 10+ second nightmare. Real-time updates grind to a halt as aggregate queries scan entire tables without indexes.

**Why it happens:**
Initial development focuses on making queries work, not making them efficient. Role-based filtering is implemented naively (filtering in application code rather than SQL), causing full table scans. Aggregate queries (COUNT, SUM, AVG) are calculated on-the-fly without pre-aggregation or materialized views. Developers don't test with production-scale data volumes.

**How to avoid:**
- Pre-aggregate statistics into summary tables updated on write (not calculated on read)
- Create materialized views for expensive aggregations that auto-update
- Index ALL columns used in WHERE clauses, JOINs, and GROUP BY operations
- Implement application-level caching for frequently-accessed metrics
- Use EXPLAIN ANALYZE to profile queries during development
- Test with 10x expected production data volume before launch

**Warning signs:**
- Query execution time increases linearly with data growth
- EXPLAIN shows "Using filesort" or "Using temporary"
- Database CPU spikes when dashboard loads
- Slow query log fills up with dashboard queries
- Users report dashboard "takes forever to load"

**Phase to address:**
Phase 2 (Core Stats Queries) - Design query architecture with scale in mind. Create summary tables and indexes BEFORE implementing dashboard UI. Add query monitoring from the start.

---

### Pitfall 3: Role-Based Access Control Bypass Through Client-Side Filtering

**What goes wrong:**
Backend sends all data to frontend, relying on JavaScript to filter based on role. Attackers modify client code or intercept API responses to view data they shouldn't access. Admin-only metrics become visible to regular users. HIPAA/compliance violations occur from unauthorized data access. This is the #1 OWASP Top 10 vulnerability (Broken Access Control) affecting 94% of applications.

**Why it happens:**
Developers implement role filtering in UI for convenience - it's easier to have one API endpoint that returns everything and filter client-side. They hide admin links from non-admin users but don't enforce backend checks. API endpoints are accessible by URL even when UI elements are hidden.

**How to avoid:**
- ALWAYS enforce role checks server-side for EVERY API endpoint
- Filter data in SQL using role_id/permissions BEFORE sending to client
- Implement middleware that validates user permissions on every request
- Never trust client-provided role/permission data - verify against session
- Use centralized authorization service, not scattered checks
- Audit logs for all data access with user/role tracking

**Warning signs:**
- Same API endpoint returns different data based only on client-side header
- API response includes data that UI doesn't render for current user
- Role checking code exists in frontend but not backend
- API testing tools (Postman) can access restricted data with regular user token
- No server logs for authorization failures

**Phase to address:**
Phase 3 (Role-Based Filtering) - Implement authorization at API layer FIRST, then build UI on top. Security testing must verify backend enforcement, not just UI hiding.

---

### Pitfall 4: Chart Library Memory Leaks from Improper Instance Management

**What goes wrong:**
Chart instances are created repeatedly without destroying old ones. Memory usage grows unbounded as Chart.js/other libraries keep references to destroyed DOM elements. Dashboard memory starts at 40MB but reaches 1GB+ after hours of real-time updates. Browser eventually crashes or tab becomes unresponsive.

**Why it happens:**
Developers call `new Chart()` on every data update instead of using `.update()` method. Chart instances aren't stored in variables, so `.destroy()` can't be called. DOM elements are removed without destroying chart instances first. With `maintainAspectRatio: false`, certain chart types leak memory in React wrappers.

**How to avoid:**
- Store chart instance in variable: `const chartInstance = new Chart(...)`
- Call `chartInstance.destroy()` before creating new chart or updating DOM
- Use `chartInstance.update()` to modify data, don't recreate chart
- Enable decimation plugin for line charts with large datasets
- Disable animations for continuously-updating charts (`animation: false`)
- Limit data points displayed (show last N entries, not entire history)
- Test memory usage over 4+ hours with real-time updates

**Warning signs:**
- Chrome DevTools Memory profiler shows Chart.js objects accumulating
- Browser tab memory in Task Manager grows continuously
- Dashboard becomes sluggish after 30-60 minutes
- Chart updates slow down progressively over time
- Browser DevTools shows thousands of detached DOM nodes

**Phase to address:**
Phase 4 (Chart Integration) - Build chart lifecycle management upfront. Include destroy/update logic in initial chart implementation, not as bug fix later.

---

### Pitfall 5: Timezone Confusion Leading to Off-By-One-Day Errors

**What goes wrong:**
Date filters show wrong data because of UTC/local timezone mismatches. "Today's stats" shows yesterday's data for users in certain timezones. Dashboard displays Jan 20 data when actual server data is from Jan 21. Date range filters are off by several hours, excluding recent data. Reports generated for "Last 7 days" include wrong days based on UTC instead of user timezone.

**Why it happens:**
Database stores timestamps without timezone info (DATETIME vs TIMESTAMPTZ). Backend converts to UTC but frontend displays in local time without adjustment. Date filters send local dates to API expecting UTC dates. Different layers use different timezone assumptions (DB in UTC, server in local, browser in user's timezone). Edge case testing doesn't cover multiple timezones.

**How to avoid:**
- Store ALL timestamps in UTC in database (use TIMESTAMPTZ type)
- Send ISO 8601 strings with timezone in API responses
- Convert to user timezone only for display, never for storage/computation
- Date filters should explicitly specify timezone when sending to API
- Test dashboard with system timezone set to UTC-12 and UTC+12
- Display timezone indicator on dashboard ("Times shown in PST")
- Be explicit: "Last 7 days" means "168 hours from now" not "7 calendar days in UTC"

**Warning signs:**
- Bug reports about "wrong data" from users in different countries
- Data appears/disappears when crossing midnight
- "Current day" filter works for US users but not Asian/European users
- Dashboard shows "no data" at start of day (in UTC) but data exists (in local)
- Queries like `DATE(timestamp) = CURDATE()` return unexpected results

**Phase to address:**
Phase 2 (Core Stats Queries) - Establish timezone handling convention before building queries. Document and enforce UTC storage, specify conversion points.

---

### Pitfall 6: Proxy/Load Balancer Breaking SSE Delivery

**What goes wrong:**
SSE works perfectly in development but fails in production. Events arrive in large batches after long delays instead of streaming in real-time. Users see no updates for minutes, then suddenly 100+ events appear at once. SSE connections timeout or never establish through corporate proxies.

**Why it happens:**
Proxies/load balancers buffer responses, waiting for complete response before forwarding. They don't recognize `Content-Type: text/event-stream` as streaming protocol. HTTP/1.1 chunked transfer encoding gets buffered at intermediary nodes. Nginx default config buffers proxy responses. CDN/CloudFlare caches or buffers event stream.

**How to avoid:**
- Set `X-Accel-Buffering: no` header for Nginx
- Configure load balancer to recognize SSE and disable buffering
- Use HTTP/2 for better streaming support through proxies
- Implement heartbeat/comment pings every 15-30 seconds to keep connection alive
- Document proxy requirements for deployment (can't use certain CDN configs)
- Test SSE through same infrastructure stack as production, not just localhost

**Warning signs:**
- SSE works locally but fails after deployment
- Browser shows "connecting" for extended period before events arrive
- Events arrive in bursts every 30-60 seconds instead of immediately
- Load balancer logs show connections timing out
- Works on direct server access but not through proxy/CDN

**Phase to address:**
Phase 1 (SSE Infrastructure) - Test through production-like infrastructure early. Include proxy/LB configuration in deployment docs from start.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Polling instead of SSE | Simpler implementation, no connection management | Higher server load, slower updates, poor scaling | Never for this project - SSE is core requirement |
| Client-side data aggregation | One simple API endpoint | Poor performance, sends unnecessary data, doesn't scale | Only for <100 records with no growth expected |
| No query indexes | Faster initial development | Queries slow exponentially with data, production issues | Never - indexes should be created upfront |
| Storing dates as strings | Works for display | Can't sort/filter properly, timezone bugs inevitable | Never - use proper timestamp types |
| Single API endpoint for all roles | Less backend code to maintain | Security vulnerabilities, over-fetching data | Never - breaks least privilege principle |
| Re-creating charts on update | Simple code pattern | Memory leaks, poor performance | Only acceptable for charts updated <1x per minute |
| No connection limits | Don't need to track connections | Users can DoS server with connection spam | Only in early prototype with trusted users |
| In-memory stats storage | Fast, no DB complexity | Data lost on restart, can't scale horizontally | Acceptable for volatile metrics (current active users) |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MySQL Connection Pool | Opening new connection per query | Use connection pooling with max/min limits configured |
| SSE EventSource | Creating multiple EventSource to same endpoint | Reuse single EventSource, multiplex events by type/ID |
| Chart.js Updates | Destroying and recreating chart instance | Call .update() method on existing instance |
| Date Filters | Sending JavaScript Date objects directly | Convert to ISO 8601 string with explicit timezone |
| Role Verification | Checking localStorage/cookies client-side | Verify JWT/session server-side on every API call |
| Real-time Updates | Sending entire dataset on every update | Send only changed/new data, client merges incrementally |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all data at once | Initial page load takes 30+ seconds | Implement pagination or infinite scroll | >1000 records |
| No query result caching | Same expensive query runs repeatedly | Cache results for 30-60 seconds | >10 concurrent users |
| Updating entire chart dataset | Chart redraw lags, animations stutter | Use Chart.js streaming plugin, limit visible points | >500 data points |
| Recalculating aggregates per request | API response time grows with data | Pre-aggregate in summary tables | >10k records |
| Sending full dataset in SSE | Events become megabytes in size | Send deltas/diffs, client reconstructs state | >100 records per update |
| No database indexes | Query time grows linearly with data | Index foreign keys, filter columns, join columns | >5k records |
| Fetching related data in loops (N+1) | Dashboard load time grows exponentially | Use JOINs or eager loading | >50 records with relations |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Role filtering in WHERE clause using user input | SQL injection through role parameter | Use prepared statements, never string concatenation |
| Exposing aggregate queries without rate limiting | Attackers enumerate data by testing filters | Implement rate limiting per IP/user |
| No validation of date range parameters | Attackers request years of data, DoS server | Limit date ranges to reasonable max (90 days) |
| Sending sensitive data in SSE without encryption | Man-in-the-middle can read real-time updates | Require HTTPS/TLS for SSE endpoints |
| Using predictable event IDs | Attackers can guess IDs and replay events | Use cryptographically random UUIDs |
| Trusting client-provided user_id in queries | User can view any other user's data | Extract user_id from verified session/JWT only |
| No CSRF protection on SSE endpoints | Attackers can establish SSE on behalf of user | Verify CSRF token or Origin header |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading states | Users unsure if dashboard is working | Show skeleton screens or spinners during load |
| No offline indicator | Users don't know SSE connection dropped | Display "Disconnected" banner when SSE fails |
| Auto-updating charts without warning | Disorienting, users lose context while reading | Pause updates on hover or provide manual refresh |
| Too many metrics on one screen | Cognitive overload, can't find important data | Group into tabs/sections, highlight critical metrics |
| No explanation of what metrics mean | Users misinterpret numbers | Add tooltips with clear definitions |
| Date range defaults to "All time" | Slow queries, too much data to comprehend | Default to "Last 7 days" or appropriate range |
| Real-time updates without rate limiting | Flickering, impossible to read | Buffer updates, apply every 2-5 seconds |
| No timezone displayed | Users confused about "today" in different zones | Show "Times in PST" or user's timezone |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **SSE Connection:** Sends data but no reconnection logic - verify auto-reconnect with exponential backoff works
- [ ] **Role Filtering:** UI hides admin features but API allows access - test with Postman/curl as regular user
- [ ] **Chart Updates:** Chart displays but memory leaks - run for 4+ hours, check memory doesn't exceed 200MB
- [ ] **Date Filters:** Works for US timezones only - test with system timezone set to UTC+12 and UTC-12
- [ ] **Error Handling:** Shows errors in dev but crashes in prod - verify graceful degradation with network failures
- [ ] **Query Performance:** Fast with 100 rows but hangs with 10k - test with 10x expected production data
- [ ] **Connection Cleanup:** Closes on page refresh but not navigation - verify EventSource.close() on all exit paths
- [ ] **Database Indexes:** Queries work but EXPLAIN shows table scan - check all filter/join columns have indexes

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SSE memory leaks discovered in prod | HIGH | 1. Add connection cleanup immediately, 2. Implement connection limits, 3. Force reconnect every 30 minutes, 4. Deploy hotfix ASAP |
| N+1 queries causing database load | MEDIUM | 1. Add query result caching (quick fix), 2. Rewrite queries with JOINs, 3. Add indexes, 4. Consider read replicas |
| Role bypass vulnerability found | CRITICAL | 1. Take affected endpoints offline, 2. Add server-side checks immediately, 3. Audit logs for unauthorized access, 4. Notify affected users |
| Chart memory leaks after deploy | MEDIUM | 1. Limit visible data points as quick fix, 2. Implement proper destroy/update cycle, 3. Add memory monitoring |
| Timezone bugs affecting reports | LOW | 1. Add timezone conversion layer, 2. Document current behavior, 3. Migrate database to TIMESTAMPTZ, 4. Test across timezones |
| Proxy buffering breaking SSE | MEDIUM | 1. Add X-Accel-Buffering header, 2. Configure load balancer, 3. Implement heartbeat, 4. Document deployment requirements |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SSE connection leaks | Phase 1: SSE Infrastructure | Run dashboard 4 hours, memory stays under 200MB |
| Database query performance | Phase 2: Core Stats Queries | EXPLAIN shows index usage, queries <100ms with 10k records |
| Role-based access bypass | Phase 3: Role Filtering | API test suite includes permission validation tests |
| Chart memory leaks | Phase 4: Chart Integration | Memory profile shows no accumulation after 100 updates |
| Timezone confusion | Phase 2: Core Stats Queries | Tests pass with UTC-12, UTC, UTC+12 system timezones |
| Proxy buffering SSE | Phase 1: SSE Infrastructure | SSE works through staging load balancer/proxy |
| Too many metrics cramped | Phase 5: Dashboard UI | User testing shows no cognitive overload feedback |
| No offline indicator | Phase 5: Dashboard UI | SSE disconnect triggers visible UI warning |

## Sources

**SSE Connection Management & Memory Leaks:**
- [The Hidden Risks of SSE: What Developers Often Overlook](https://medium.com/@2957607810/the-hidden-risks-of-sse-server-sent-events-what-developers-often-overlook-14221a4b3bfe)
- [How to Implement Server-Sent Events (SSE) in React](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view)
- [Server Sent Events are still not production ready after a decade](https://dev.to/miketalbot/server-sent-events-are-still-not-production-ready-after-a-decade-a-lesson-for-me-a-warning-for-you-2gie)
- [Possible memory leak when using server side events - NestJS Issue](https://github.com/nestjs/nest/issues/11601)

**Dashboard Performance & UX:**
- [From Data To Decisions: UX Strategies For Real-Time Dashboards](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- [Top 10 Mistakes in Observability Dashboards](https://logz.io/blog/top-10-mistakes-building-observability-dashboards/)
- [Bad Dashboard Examples: Common Design Mistakes to Avoid](https://databox.com/bad-dashboard-examples)

**Database Query Performance:**
- [Solving the N+1 Query Problem](https://dev.to/vasughanta09/solving-the-n1-query-problem-a-developers-guide-to-database-performance-321c)
- [The N+1 Query Problem: The Silent Performance Killer](https://dev.to/lovestaco/the-n1-query-problem-the-silent-performance-killer-2b1c)
- [How to Optimize Real-Time Dashboard Performance](https://www.topanalyticstools.com/blog/how-to-optimize-real-time-dashboard-performance/)
- [MySQL Query Optimization: Faster Performance & Data Retrieval](https://airbyte.com/data-engineering-resources/optimizing-mysql-queries)

**Role-Based Access Control:**
- [OWASP Top 10 Broken Access Control Explained](https://www.securityjourney.com/post/owasp-top-10-broken-access-control-explained)
- [Access control vulnerabilities and privilege escalation](https://portswigger.net/web-security/access-control)
- [Broken Access Control: How to Detect and Prevent](https://www.invicti.com/blog/web-security/broken-access-control)

**Chart.js Memory & Performance:**
- [Massive memory leak with maintainAspectRatio:false - Chart.js Issue](https://github.com/chartjs/Chart.js/issues/11299)
- [Line chart causes browser memory leak - Chart.js Issue](https://github.com/chartjs/Chart.js/issues/462)
- [Chart.js Performance Documentation](https://www.chartjs.org/docs/latest/general/performance.html)

**Timezone Handling:**
- [Dashboard Logs: timezone mismatch - looks for wrong date file](https://github.com/moltbot/moltbot/issues/1343)
- [Dashboard field date filters not using reporting timezone - Metabase](https://discourse.metabase.com/t/dashboard-field-date-filters-no-using-reporting-timezone/15383)
- [Work with time and region settings - ArcGIS Dashboards](https://doc.arcgis.com/en/dashboards/latest/get-started/time-and-region-settings.htm)

**Go SSE Best Practices:**
- [How to Implement Server-Sent Events in Go](https://www.freecodecamp.org/news/how-to-implement-server-sent-events-in-go/)
- [Server-Sent Events: A Practical Guide for the Real World](https://tigerabrodi.blog/server-sent-events-a-practical-guide-for-the-real-world)
- [Using Server Sent Events to Simplify Real-time Streaming at Scale - Shopify](https://shopify.engineering/server-sent-events-data-streaming)

**Vanilla JS Performance:**
- [Patterns for efficient DOM manipulation with vanilla JavaScript](https://blog.logrocket.com/patterns-efficient-dom-manipulation-vanilla-javascript/)
- [Patterns for Memory Efficient DOM Manipulation](https://frontendmasters.com/blog/patterns-for-memory-efficient-dom-manipulation/)
- [Optimizing DOM Updates in JavaScript for Better Performance](https://dev.to/alex_aslam/optimizing-dom-updates-in-javascript-for-better-performance-90k)

---
*Pitfalls research for: Real-time Stats Dashboard with SSE (Go + MySQL + Vanilla JS)*
*Researched: 2026-02-03*
*Confidence: MEDIUM - Based on verified WebSearch findings from recent sources, corroborated across multiple authoritative sources. Not verified against official documentation for all technologies.*
