---
phase: 02-role-based-data-layer
plan: 01
subsystem: database
tags: [mysql, sqlc, sql, recursive-cte, role-based-access-control]

# Dependency graph
requires:
  - phase: 01-sse-infrastructure-navigation
    provides: Navigation structure and SSE infrastructure
provides:
  - Role-based SQL queries with company-scoped and manager hierarchy filtering
  - 4 admin queries (GetTasksByCompany, GetCallsByCompany, GetTaskStatsByCompany, GetCallStatsByCompany)
  - 5 manager queries (GetSubordinatesByManager, GetTasksByManager, GetCallsByManager, GetTaskStatsByManager, GetCallStatsByManager)
affects: [02-02, 02-03, 03-backend-api-endpoints]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recursive CTEs for multi-level hierarchy traversal"
    - "Company-scoped queries with JOIN-based filtering"
    - "Role-based WHERE clauses at SQL layer"

key-files:
  created: []
  modified:
    - api/queries.sql
    - api/db/queries.sql.go

key-decisions:
  - "Filter by company_id at SQL layer to prevent unauthorized data access"
  - "Use recursive CTEs with UNION ALL for manager hierarchy traversal"
  - "Filter by is_active = 1 to exclude deactivated users from hierarchy"
  - "Accept both reports_to and company_id parameters to prevent cross-company leaks"

patterns-established:
  - "Pattern 1: All role-based queries enforce authorization at SQL layer with WHERE clauses"
  - "Pattern 2: Manager queries use recursive CTEs to find all subordinates (direct and indirect)"
  - "Pattern 3: All hierarchy queries filter by is_active to exclude deactivated users"

# Metrics
duration: 3.4min
completed: 2026-02-06
---

# Phase 2 Plan 1: Role-Based Data Layer Summary

**SQL queries with company-scoped filters and recursive CTEs for manager hierarchies, enforcing authorization at the database layer**

## Performance

- **Duration:** 3.4 min
- **Started:** 2026-02-06T14:13:30Z
- **Completed:** 2026-02-06T14:16:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added 4 company-scoped queries for admin role with WHERE company_id filters
- Added 5 manager hierarchy queries using MySQL 8.0 recursive CTEs
- All queries enforce role-based access control at SQL layer (OWASP Top 10 #1 mitigation)
- Generated and verified Go code with sqlc, confirmed compilation with go build

## Task Commits

Each task was committed atomically:

1. **Task 1: Add company-scoped queries for admin role** - `2c07211` (feat)
2. **Task 2: Add manager hierarchy queries with recursive CTEs** - `54a57b9` (feat)

## Files Created/Modified
- `api/queries.sql` - Added 9 new role-based authorization queries (4 company-scoped, 5 manager hierarchy)
- `api/db/queries.sql.go` - Generated Go code with type-safe query functions

## Decisions Made
- **Filter at SQL layer:** All queries enforce company_id or reports_to filters in WHERE clauses to prevent unauthorized data from reaching the API
- **Recursive CTE pattern:** Manager queries use `WITH RECURSIVE subordinates AS (... UNION ALL ...)` to traverse multi-level reporting hierarchies
- **Active users only:** All hierarchy queries filter by `is_active = 1` to exclude deactivated users
- **Double parameter protection:** Manager queries accept both `reports_to` AND `company_id` to prevent cross-company data leaks in multi-tenant scenarios

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ambiguous column references in recursive CTEs**
- **Found during:** Task 2 (Manager hierarchy queries)
- **Issue:** sqlc generate failed with "column reference 'reports_to' is ambiguous" because base case SELECT didn't use table alias
- **Fix:** Added table alias `u` to base case SELECT statements: `SELECT u.id FROM users u WHERE u.reports_to = ?`
- **Files modified:** api/queries.sql (all 5 manager queries)
- **Verification:** sqlc generate completed successfully, go build passed
- **Committed in:** 54a57b9 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix was necessary for SQL compilation. No scope creep.

## Issues Encountered
- Initial recursive CTE syntax caused sqlc ambiguous column error - resolved by adding table aliases to base case SELECT

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SQL queries ready for backend API endpoint integration
- Generated Go code provides type-safe database access
- Ready for Phase 2 Plan 2: Backend API endpoints with role-based routing

**Blocker check:** None - all queries compile and generate successfully

---
*Phase: 02-role-based-data-layer*
*Completed: 2026-02-06*
