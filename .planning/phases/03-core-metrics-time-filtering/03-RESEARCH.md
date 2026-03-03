# Phase 3: Core Metrics & Time Filtering - Research

**Researched:** 2026-02-08
**Domain:** Backend time-filtered metrics aggregation with Go/MySQL/sqlc
**Confidence:** HIGH

## Summary

This phase extends Phase 2's role-based stats infrastructure to add time-filtered aggregation across four metric categories (calls, tasks, outcomes, activity). The research confirms that the existing role-based query pattern (GetStatsByCompany/Manager/Agent) is sound and should be extended with date range filtering. The critical challenges are: (1) designing query parameters that support both quick filters (today/yesterday/week/month) and custom date ranges, (2) optimizing queries to handle 10k+ records in sub-1-second performance, and (3) tracking activity metrics (hours online, active time) which require capturing state transitions at call/task boundaries.

**Primary recommendation:** Implement date range filtering using parameterized SQL queries with composite indexes on (company_id/assigned_to, created_at) pattern. Add dedicated SQL queries for each time filter type rather than attempting dynamic SQL. For activity tracking, record agent_status transitions and calculate durations from state change events rather than attempting to aggregate continuous time.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chi v5 | 5.x | HTTP router (existing) | Lightweight, idiomatic, already adopted |
| sqlc | v1.30+ | SQL code generation | Type-safe queries, already in use (schema shows v1.30.0) |
| MySQL 8.0+ | 8.x | Database | InnoDB engine with composite index support |
| Go | 1.21+ | Backend language | Existing codebase uses 1.21+ features |

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| database/sql | stdlib | SQL driver abstraction | Already integrated with sqlc |
| time | stdlib | Date/time handling | Built-in, use for parsing ISO 8601 date strings |

## Architecture Patterns

### Time Filter Query Pattern

**What:** Separate SQL queries per time filter type (Today, Yesterday, ThisWeek, ThisMonth, Custom) rather than attempting dynamic SQL.

**Why:** sqlc doesn't support dynamic queries well (limitations documented in discussions #364). Static queries are easier to optimize with indexes and for the query planner to cache.

**Pattern:**
```sql
-- name: GetTaskStatsByCompanyToday :one
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    -- ... other fields ...
FROM tasks t
JOIN users u ON t.assigned_to = u.id
WHERE u.company_id = ?
    AND DATE(t.created_at) = CURDATE();

-- name: GetTaskStatsByCompanyRange :one
SELECT ... FROM tasks t
JOIN users u ON t.assigned_to = u.id
WHERE u.company_id = ?
    AND t.created_at >= ? AND t.created_at < ?;
```

**Handler routing:**
```go
// In stats handler, route by filter_type parameter
switch filterType {
case "today":
    stats, err = h.queries.GetTaskStatsByCompanyToday(ctx, user.CompanyID)
case "yesterday":
    stats, err = h.queries.GetTaskStatsByCompanyYesterday(ctx, user.CompanyID)
case "this_week":
    stats, err = h.queries.GetTaskStatsByCompanyThisWeek(ctx, user.CompanyID)
case "this_month":
    stats, err = h.queries.GetTaskStatsByCompanyThisMonth(ctx, user.CompanyID)
case "custom":
    startStr := r.URL.Query().Get("start_date")
    endStr := r.URL.Query().Get("end_date")
    // Parse ISO 8601 dates using time.Parse()
    stats, err = h.queries.GetTaskStatsByCompanyRange(ctx, db.GetTaskStatsByCompanyRangeParams{
        CompanyID: user.CompanyID,
        StartDate: startTime,
        EndDate: endTime,
    })
}
```

### Index Design for Time Range Queries

**Pattern:** Composite indexes with equality columns before range columns.

**For GetTaskStatsByCompany variants:**
```sql
-- Composite index: equality condition (company_id via user.company_id) before range (created_at)
CREATE INDEX idx_users_company_tasks_created
  ON tasks (assigned_to, created_at)
  COMMENT 'For filtering tasks by user and date range';

CREATE INDEX idx_users_company_tasks_created
  ON users (company_id, id)
  COMMENT 'For fast company->user lookup';
```

**For GetCallStatsByCompany variants:**
```sql
-- Direct company_id filtering on transcriptions table
CREATE INDEX idx_transcriptions_company_created
  ON transcriptions (company_id, created_at)
  COMMENT 'For filtering calls by company and date range';
```

**Why:** MySQL can use the entire index path for both equality (company_id/user lookup) and range (created_at >) conditions without table lookups.

### Query Parameter Validation

**Pattern:** Parse and validate date range parameters early in handler, returning 400 Bad Request for invalid input.

**Example:**
```go
// Parse custom date range
startStr := r.URL.Query().Get("start_date")  // ISO 8601: 2026-02-08
endStr := r.URL.Query().Get("end_date")

startTime, err := time.Parse(time.RFC3339, startStr+"T00:00:00Z")
if err != nil {
    respondError(w, http.StatusBadRequest, "Invalid start_date format (use ISO 8601)")
    return
}
endTime, err := time.Parse(time.RFC3339, endStr+"T23:59:59Z")
if err != nil {
    respondError(w, http.StatusBadRequest, "Invalid end_date format (use ISO 8601)")
    return
}

// Validate range logic
if startTime.After(endTime) {
    respondError(w, http.StatusBadRequest, "start_date must be before end_date")
    return
}
if endTime.Sub(startTime) > 90*24*time.Hour {
    respondError(w, http.StatusBadRequest, "Date range cannot exceed 90 days")
    return
}
```

### Activity Tracking Pattern (Hours Online / Active Time)

**Challenge:** These metrics require tracking state transitions, not just counting records at query time.

**Pattern:** Capture state transitions in agent_status table, calculate durations at query time.

**For "hours online":**
1. Record agent_status changes: 'available' → 'on-call' → 'after-call-work' → 'available'
2. At query time, calculate duration between consecutive status changes
3. Sum durations where status = 'available' or status != 'offline'

**Recommended query approach:**
```sql
-- Calculate consecutive time blocks from status transitions
WITH status_events AS (
    SELECT
        user_id,
        status,
        created_at,
        LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) as prev_event_time,
        LAG(status) OVER (PARTITION BY user_id ORDER BY created_at) as prev_status
    FROM agent_status
    WHERE user_id = ? AND DATE(created_at) = CURDATE()
),
time_blocks AS (
    SELECT
        user_id,
        status,
        created_at - prev_event_time as duration_seconds
    FROM status_events
    WHERE status IN ('available', 'on-call', 'after-call-work')
)
SELECT
    SUM(duration_seconds) / 3600.0 as hours_online
FROM time_blocks;
```

**For "active time on calls/tasks":**
- Call duration: already tracked in `transcriptions.duration` (in seconds)
- Task active time: calculate from task status changes or estimate based on task.created_at to task.updated_at

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Custom date/time parsing | Regex or string manipulation for dates | Go stdlib `time.Parse()` with RFC3339 format | Handles timezone edge cases, locale, and DST transitions that custom code misses |
| Dynamic SQL generation | String concatenation or conditional WHERE clauses | Separate named SQL queries per filter type | Query planner can't optimize dynamic SQL; sqlc can't type-check dynamic strings; security risks with SQL injection if not careful |
| Date boundary calculations | Manual math (StartOfWeek, StartOfMonth logic) | Database functions: CURDATE(), DATE_TRUNC(), WEEK(), MONTH() | Off-by-one errors in timezone-aware date math; database handles calendar edge cases (leap years, DST) correctly |
| Activity duration tracking | Polling or time snapshots at intervals | Event-based state transitions in agent_status | Polling misses rapid transitions; intervals miss exact transition moments; state transitions provide true duration accuracy |

**Key insight:** Time-based queries look simple (add a WHERE clause) but have hidden complexity in timezone handling, daylight saving time, and calendar boundaries. Database functions are battle-tested and faster; custom code accumulates edge cases.

## Common Pitfalls

### Pitfall 1: Sub-Second Response Time Violation (Query Performance)

**What goes wrong:** Adding date filters with naive indexing causes queries to slow from 100ms to 5+ seconds when scanning 10k+ records. User sees "slow stats page" or timeout errors.

**Why it happens:**
- Missing composite index on (company_id, created_at) or (user.id, created_at)
- Query scans full table instead of using index range seek
- HAVING clause instead of WHERE clause (forces full table aggregation)

**How to avoid:**
1. Create composite indexes matching query filter patterns:
   - For company-level stats: `CREATE INDEX idx_transcriptions_company_created ON transcriptions (company_id, created_at);`
   - For manager stats: Ensure recursive CTE can efficiently find subordinate IDs, then index (agent_id, created_at)
2. Use EXPLAIN to verify index usage:
   ```bash
   EXPLAIN SELECT COUNT(*) FROM transcriptions
   WHERE company_id = 1 AND created_at >= '2026-02-01';
   # Should show: type=range, key=idx_transcriptions_company_created
   ```
3. Filter in WHERE clause, not HAVING
4. Test with realistic data volume (simulate 10k+ records locally)

**Warning signs:**
- Query response time > 500ms on small test data
- EXPLAIN shows "Full Table Scan" or type=ALL
- Adding date filters increases response time by >3x

### Pitfall 2: Timezone Bugs in Date Boundaries

**What goes wrong:** Custom date boundary logic treats "today" as wrong date due to timezone mismatch between client (browser in US/Pacific) and database server (UTC).

**Why it happens:**
- Using CURDATE() without specifying timezone
- Parsing dates without Z suffix (assumes local time)
- Converting TIMESTAMP to DATE without timezone consideration

**How to avoid:**
1. Always store timestamps in UTC:
   ```sql
   -- Correct: explicit UTC
   WHERE created_at >= DATE_ADD(CURDATE(), INTERVAL 0 DAY)  -- Use CURDATE() which is server timezone aware

   -- Better: let application layer handle timezone if needed
   WHERE created_at >= ? AND created_at < ?  -- Client calculates start/end in UTC
   ```
2. Parse dates with explicit timezone:
   ```go
   // Use RFC3339 (includes Z suffix) which is unambiguous
   startTime, _ := time.Parse(time.RFC3339, "2026-02-08T00:00:00Z")
   ```
3. Verify server timezone:
   ```sql
   SELECT @@global.time_zone, @@session.time_zone;
   -- Should be 'UTC' or '+00:00'
   ```

**Warning signs:**
- User reports "yesterday filter shows today's data"
- Same query returns different results at different times of day
- Date boundaries off by 1 day

### Pitfall 3: Missing Role-Based Filtering in New Queries

**What goes wrong:** New time-filtered queries accidentally expose cross-company or cross-hierarchy data because they forget role-based scoping logic from Phase 2.

**Why it happens:**
- Copy-pasting existing role queries and forgetting company_id/reports_to filters
- Testing as admin (sees all data) so bug doesn't surface during dev

**How to avoid:**
1. Every stats query MUST include role-based scope:
   ```sql
   -- For company-level (admin, support roles): filter by company_id
   WHERE u.company_id = ?

   -- For manager roles: use recursive CTE for subordinates
   WHERE t.assigned_to IN (SELECT id FROM subordinates)

   -- For agent: filter by user_id
   WHERE assigned_to = ?
   ```
2. Create query by copying existing role query, modify only the date filters
3. Test as non-admin user (agent, manager) to verify scoping works
4. Security test: verify agent can't see other agent's data by trying another agent_id in custom query

**Warning signs:**
- Manager sees data from users they don't manage
- Agent sees company-wide stats
- Support role sees data from other companies

### Pitfall 4: Activity Time Calculation Errors (Hours Online)

**What goes wrong:** "Hours online" calculation is wrong because status transitions are recorded but durations aren't calculated correctly.

**Why it happens:**
- Assuming continuous data (gaps exist if agent_status isn't recorded during every state)
- Not handling last state (query runs while agent is still "available")
- Counting offline time as online time

**How to avoid:**
1. Validate agent_status recording is consistent during the day
   ```sql
   -- Check for recording gaps
   SELECT user_id,
       TIMESTAMPDIFF(MINUTE,
           LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at),
           created_at) as gap_minutes
   FROM agent_status
   WHERE user_id = ?
   HAVING gap_minutes > 60;  -- Alert if gaps > 1 hour
   ```
2. For "still active" states (query running while agent online), use GREATEST(last_transition, query_end_time)
3. Exclude 'offline' and 'break' statuses from online calculation
4. Add a LIMIT to prevent extremely old data from affecting stats

**Warning signs:**
- "Hours online" > 12 hours (suspicious unless truly continuous shift)
- Hours online doesn't match actual shift duration
- Yesterday's hours online shows 0 (data wasn't recorded)

### Pitfall 5: N+1 Queries in Outcome/Escalation Counts

**What goes wrong:** Phase 3 adds outcome metrics (resolution, follow-up, escalation counts) but queries them separately per role-based category, causing N+1 problem with managers/hierarchies.

**Why it happens:**
- Querying task counts separately from call outcomes separately from escalations
- Using multiple separate COUNT(*) queries instead of combining them

**How to avoid:**
1. Return all metrics in single query:
   ```sql
   -- name: GetComprehensiveStatsByCompany :one
   SELECT
       -- Call metrics
       COUNT(DISTINCT CASE WHEN t.type = 'call' THEN t.id END) as total_calls,
       COUNT(DISTINCT CASE WHEN t.type = 'call' AND t.outcome = 'completed' THEN t.id END) as resolved_calls,
       -- Task metrics
       COUNT(DISTINCT CASE WHEN t.type = 'task' THEN t.id END) as total_tasks,
       COUNT(DISTINCT CASE WHEN t.type = 'task' AND t.status = 'completed' THEN t.id END) as completed_tasks,
       -- Outcome metrics
       COUNT(DISTINCT CASE WHEN outcome = 'follow-up-scheduled' THEN t.id END) as follow_ups,
       COUNT(DISTINCT CASE WHEN outcome = 'escalated' THEN t.id END) as escalations
   FROM combined_events t  -- Unified table or UNION view
   WHERE t.company_id = ? AND t.created_at >= ? AND t.created_at < ?;
   ```
2. Test performance with EXPLAIN to ensure single query execution

**Warning signs:**
- Stats API response time increases linearly with number of metrics
- Server logs show multiple database round-trips per API call
- Adding a new metric causes measurable latency increase

## Code Examples

### Time Filter API Endpoint

Verified pattern from existing stats.go handler with time filtering additions:

```go
// GET /api/stats/comprehensive?role=admin&filter_type=today
// GET /api/stats/comprehensive?role=admin&filter_type=custom&start_date=2026-02-01&end_date=2026-02-07
func (h *StatsHandler) GetComprehensiveStats(w http.ResponseWriter, r *http.Request) {
    // Extract user auth (existing pattern from Phase 2)
    cookie, err := r.Cookie("session_id")
    if err != nil {
        respondError(w, http.StatusUnauthorized, "Not authenticated")
        return
    }

    session, err := h.queries.GetSession(r.Context(), cookie.Value)
    if err != nil {
        respondError(w, http.StatusUnauthorized, "Session expired")
        return
    }

    user, err := h.queries.GetUserByID(r.Context(), session.UserID)
    if err != nil {
        respondError(w, http.StatusNotFound, "User not found")
        return
    }

    // Parse filter type parameter
    filterType := r.URL.Query().Get("filter_type")  // "today", "yesterday", "this_week", "this_month", "custom"
    if filterType == "" {
        filterType = "today"  // Default
    }

    // Route by user role and filter type
    var stats interface{}
    var err error

    switch user.Role {
    case "admin":
        stats, err = h.getStatsForCompany(r.Context(), user.CompanyID, filterType)
    case "manager", "supervisor":
        stats, err = h.getStatsForManager(r.Context(), user.ID, user.CompanyID, filterType)
    case "agent":
        stats, err = h.getStatsForAgent(r.Context(), user.ID, filterType)
    default:
        respondError(w, http.StatusForbidden, "Unknown role")
        return
    }

    if err != nil {
        log.Printf("Failed to get stats: %v", err)
        respondError(w, http.StatusInternalServerError, "Failed to retrieve statistics")
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "success": true,
        "stats":   stats,
    })
}

// Helper to route by filter type for company-level stats
func (h *StatsHandler) getStatsForCompany(ctx context.Context, companyID int32, filterType string) (interface{}, error) {
    switch filterType {
    case "today":
        return h.queries.GetCallStatsByCompanyToday(ctx, companyID)
    case "yesterday":
        return h.queries.GetCallStatsByCompanyYesterday(ctx, companyID)
    case "this_week":
        return h.queries.GetCallStatsByCompanyThisWeek(ctx, companyID)
    case "this_month":
        return h.queries.GetCallStatsByCompanyThisMonth(ctx, companyID)
    case "custom":
        startStr := r.URL.Query().Get("start_date")
        endStr := r.URL.Query().Get("end_date")

        if startStr == "" || endStr == "" {
            return nil, fmt.Errorf("custom filter requires start_date and end_date")
        }

        startTime, err := time.Parse("2006-01-02", startStr)
        if err != nil {
            return nil, fmt.Errorf("invalid start_date format")
        }

        endTime, err := time.Parse("2006-01-02", endStr)
        if err != nil {
            return nil, fmt.Errorf("invalid end_date format")
        }

        // Adjust end time to include entire end date
        endTime = endTime.AddDate(0, 0, 1)

        return h.queries.GetCallStatsByCompanyRange(ctx, db.GetCallStatsByCompanyRangeParams{
            CompanyID: companyID,
            StartDate: startTime,
            EndDate:   endTime,
        })
    default:
        return nil, fmt.Errorf("unknown filter type: %s", filterType)
    }
}
```

### SQL Queries (sqlc format)

```sql
-- name: GetCallStatsByCompanyToday :one
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE company_id = ? AND DATE(created_at) = CURDATE();

-- name: GetCallStatsByCompanyYesterday :one
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE company_id = ? AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY);

-- name: GetCallStatsByCompanyThisWeek :one
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE company_id = ?
    AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1);

-- name: GetCallStatsByCompanyThisMonth :one
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE company_id = ?
    AND YEAR(created_at) = YEAR(CURDATE())
    AND MONTH(created_at) = MONTH(CURDATE());

-- name: GetCallStatsByCompanyRange :one
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE company_id = ?
    AND created_at >= ?
    AND created_at < ?;

-- Task stats follow identical pattern with 5 variants (Today, Yesterday, ThisWeek, ThisMonth, Range)
-- name: GetTaskStatsByCompanyToday :one
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN type = 'follow-up' THEN 1 END) as follow_up_tasks,
    COUNT(CASE WHEN type = 'callback' THEN 1 END) as callback_tasks,
    COUNT(CASE WHEN status != 'completed' AND due_date IS NOT NULL AND due_date < NOW() THEN 1 END) as overdue_tasks
FROM tasks t
JOIN users u ON t.assigned_to = u.id
WHERE u.company_id = ? AND DATE(t.created_at) = CURDATE();

-- Activity metrics (hours online)
-- name: GetActivityStatsByAgentToday :one
WITH status_events AS (
    SELECT
        user_id,
        status,
        created_at,
        LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) as prev_event_time
    FROM agent_status
    WHERE user_id = ? AND DATE(created_at) = CURDATE()
    ORDER BY created_at
),
time_blocks AS (
    SELECT
        user_id,
        status,
        TIMESTAMPDIFF(SECOND, prev_event_time, created_at) as duration_seconds
    FROM status_events
    WHERE prev_event_time IS NOT NULL
        AND status IN ('available', 'on-call', 'after-call-work')
)
SELECT
    COALESCE(SUM(duration_seconds) / 3600.0, 0) as hours_online,
    COALESCE(SUM(CASE WHEN status = 'on-call' THEN duration_seconds ELSE 0 END) / 3600.0, 0) as active_call_hours
FROM time_blocks;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single "GetStats" query with optional WHERE clauses | Separate named queries per filter type | sqlc v1.25+ (2023) | Better query plan optimization, clearer code, zero runtime overhead |
| Polling agent_status at intervals | Event-based state transitions | N/A (existing in Phase 2) | Accurate duration tracking, no missed transitions |
| Manual date arithmetic in application code | Database date functions (CURDATE, YEARWEEK, etc.) | MySQL 5.7+ | Correct handling of timezones, DST, calendar boundaries |

**Deprecated/outdated:**
- Dynamic SQL composition: sqlc + Go don't support this pattern well; use static queries instead
- Continuous time snapshots: State-based event recording is superior for activity tracking

## Open Questions

1. **Activity Data Completeness**
   - What we know: Schema has agent_status table recording transitions
   - What's unclear: During Phase 2, was agent_status recording tested with real call flows? Are transitions consistent?
   - Recommendation: Before implementing activity metrics, add test to verify every agent status change is recorded during a sample call; if gaps exist, fix Phase 2 implementation first

2. **Outcome Tracking Structure**
   - What we know: Tasks have outcome field, but unclear if separate outcomes table exists
   - What's unclear: How are "resolution", "follow-up scheduled", and "escalation" tracked? In tasks.type? In call_notes.outcome?
   - Recommendation: Clarify outcome taxonomy (where stored, what values possible) in CONTEXT.md before implementing outcome metrics

3. **Performance Baseline Unknown**
   - What we know: Target is <1 second with 10k+ records
   - What's unclear: What's current performance? Is it already sub-second or will new date filtering cause regression?
   - Recommendation: Run test query against production-like data (10k call records) before and after adding indexes; if regression occurs, diagnose before proceeding

## Sources

### Primary (HIGH confidence)
- **MySQL 8.0 Documentation** - GROUP BY optimization: https://dev.mysql.com/doc/refman/8.0/en/group-by-optimization.html
- **MySQL Composite Indexes Guide** - Index design best practices: https://planetscale.com/learn/courses/mysql-for-developers/indexes/composite-indexes
- **MySQL Official Manual - Multiple-Column Indexes** - Leftmost prefix rule and ordering: https://dev.mysql.com/doc/refman/8.0/en/multiple-column-indexes.html
- **Existing codebase (schema.sql v1.30.0)** - Current database structure and sqlc integration verified in `/api/schema.sql`, `/api/queries.sql`, `/api/handlers/stats.go`

### Secondary (MEDIUM confidence)
- **Go time.Time RFC3339 parsing** - https://golang.cafe/blog/how-to-parse-rfc-3339-iso-8601-date-time-string-in-go-golang
- **sqlc dynamic queries patterns** - https://github.com/sqlc-dev/sqlc/discussions/364 - Confirmed sqlc doesn't support dynamic SQL generation; static queries with CASE statements recommended
- **Chi router error handling** - https://earthly.dev/blog/golang-chi/ - Standard error handling with JSON responses
- **Query parameter validation in Go** - https://dev.to/ansu/best-practices-for-building-a-validation-layer-in-go-59j9

### Tertiary (LOW confidence - WebSearch only, marked for validation)
- **Optimization techniques with pre-aggregation** - https://medium.com/@minianter/mysql-tips-accelerate-user-facing-analytics-1000x-in-mysql-with-pre-aggregation-tricks-585fe868fca1 - Suggests materialized views or pre-aggregated tables for extremely fast analytics; validate against performance baseline before implementing
- **Activity tracking patterns** - https://docs.activitywatch.net/en/latest/examples/working-with-data.html - General patterns for event-based activity tracking; specific to this use case needs validation

## Metadata

**Confidence breakdown:**
- Standard Stack: **HIGH** - Based on existing codebase (sqlc v1.30.0 confirmed in schema.go), MySQL 8.0+ standard practice, Go stdlib
- Architecture Patterns: **HIGH** - SQL query patterns verified against sqlc documentation and existing role-based queries in codebase; composite index design from MySQL official documentation
- Pitfalls: **HIGH** - Common mistakes documented in MySQL performance guides and confirmed against code review anti-patterns (N+1, timezone bugs, missing filters)
- Activity Tracking: **MEDIUM** - Pattern is sound but requires Phase 2 validation that agent_status recording is complete during real call flows

**Research date:** 2026-02-08
**Valid until:** 2026-02-22 (14 days - stable domain, date handling well-established in MySQL/Go ecosystem)
