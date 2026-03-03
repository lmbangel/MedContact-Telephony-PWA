---
phase: 03-core-metrics-time-filtering
plan: 01
subsystem: database
tags: [mysql, sqlc, indexes, time-filtering, aggregation]

# Dependency graph
requires:
  - phase: 02-role-based-data-layer
    provides: Role-based stat queries (GetCallStatsByCompany, GetCallStatsByManager, GetTaskStatsByCompany, GetTaskStatsByManager)
provides:
  - Composite indexes for time-range query performance
  - Time-filtered call stat queries (Today, Yesterday, ThisWeek, ThisMonth, Range)
  - Time-filtered task stat queries (Today, Yesterday, ThisWeek, ThisMonth, Range)
  - sqlc-generated Go code for all new queries
affects: [03-02 (API endpoints), 03-03 (UI integration)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Separate query per time filter (not dynamic SQL)
    - Composite indexes with equality columns before range columns
    - Date arithmetic for week filtering (sqlc MySQL compatibility)

key-files:
  created: []
  modified:
    - api/schema.sql
    - api/queries.sql
    - api/db/queries.sql.go

key-decisions:
  - "Use date arithmetic instead of YEARWEEK for sqlc MySQL parser compatibility"
  - "Prefix ambiguous column references with table names in CTE queries"

patterns-established:
  - "Time filter query pattern: GetXByY(Today|Yesterday|ThisWeek|ThisMonth|Range)"
  - "Composite index pattern: (company_id|agent_id|assigned_to, created_at)"

# Metrics
duration: 15min
completed: 2026-02-09
---

# Phase 3 Plan 01: Database Indexes & Time-Filtered Queries Summary

**Composite indexes on transcriptions/tasks tables with 20 new time-filtered SQL queries for call and task stats across admin and manager roles**

## Performance

- **Duration:** 15 min (across session break)
- **Started:** 2026-02-08T20:34:32Z
- **Completed:** 2026-02-09T08:07:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added 3 composite indexes for time-range query optimization
- Created 10 time-filtered call stat queries (5 admin/support, 5 manager)
- Created 10 time-filtered task stat queries (5 admin/support, 5 manager)
- Regenerated sqlc Go code with type-safe query functions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add composite indexes for time-filtered queries** - `c895ff0` (feat)
2. **Task 2: Create time-filtered call stat queries for all roles** - `4ab5a93` (feat)
3. **Task 3: Create time-filtered task stat queries for all roles** - `34c48dc` (feat)

## Files Created/Modified
- `api/schema.sql` - Added idx_transcriptions_company_created, idx_transcriptions_agent_created, idx_tasks_assigned_created
- `api/queries.sql` - Added 20 new time-filtered stat queries
- `api/db/queries.sql.go` - Regenerated with new query functions

## Decisions Made
- **YEARWEEK replacement:** sqlc MySQL parser doesn't recognize YEARWEEK function. Replaced with date arithmetic: `created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND created_at < DATE_ADD(...)`
- **Table prefix for ambiguous columns:** GetCallStatsByManagerRange had ambiguous `created_at` reference - prefixed with `transcriptions.` table name

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sqlc MySQL parser doesn't recognize YEARWEEK function**
- **Found during:** Task 2 (Call stat queries)
- **Issue:** sqlc generate failed with "function yearweek(unknown, unknown) does not exist" - parser using PostgreSQL validation
- **Fix:** Replaced YEARWEEK(x, 1) = YEARWEEK(CURDATE(), 1) with date arithmetic for start-of-week calculation
- **Files modified:** api/queries.sql
- **Verification:** sqlc generate succeeds
- **Committed in:** 34c48dc (Task 3 commit)

**2. [Rule 3 - Blocking] Ambiguous column reference in GetCallStatsByManagerRange**
- **Found during:** Task 3 (sqlc regeneration)
- **Issue:** `created_at` in WHERE clause ambiguous between transcriptions and CTE
- **Fix:** Prefixed with `transcriptions.created_at`
- **Files modified:** api/queries.sql
- **Verification:** sqlc generate succeeds
- **Committed in:** 34c48dc (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for sqlc code generation. Queries functionally equivalent to plan specification.

## Issues Encountered
- sqlc v1.30.0 MySQL engine has incomplete function recognition for MySQL-specific functions like YEARWEEK - required alternative date arithmetic approach

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Database layer complete with performance indexes and time-filtered queries
- Ready for Plan 03-02: API endpoint integration to expose time-filtered stats
- All role-based scoping from Phase 2 preserved in new queries

---
*Phase: 03-core-metrics-time-filtering*
*Completed: 2026-02-09*
