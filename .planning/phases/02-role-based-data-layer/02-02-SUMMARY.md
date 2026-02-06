---
phase: 02-role-based-data-layer
plan: 02
subsystem: api-handlers
tags: [go, chi-router, role-based-access, javascript, ui]

# Dependency graph
requires:
  - phase: 02-role-based-data-layer
    plan: 01
    provides: Role-based SQL queries with recursive CTEs
provides:
  - Role-based stats API handlers routing to filtered queries
  - Protected /api/companies endpoint for support role
  - Company filter UI for support role in stats page
affects: [02-03, 03-backend-api-endpoints, 04-real-time-stats]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Role-based handler routing with switch on user.Role"
    - "Chi router groups with RequireRole middleware"
    - "Conditional UI rendering based on user role"

key-files:
  created:
    - api/handlers/stats.go
  modified:
    - api/main.go
    - app/dashboard-stats.html
    - app/src/dashboard-stats.js

key-decisions:
  - "Route stats handlers to different queries based on user.Role field"
  - "Support role requires company_id parameter (never unfiltered access)"
  - "Protect /api/companies with role middleware (exclude agent role)"
  - "Show company filter only for support role in UI"

patterns-established:
  - "Pattern 1: Stats handlers check session, get user, switch on role, call appropriate query"
  - "Pattern 2: Support role gets company-scoped queries with required company_id parameter"
  - "Pattern 3: Company filter dropdown conditionally rendered based on user.role === 'support'"

# Metrics
duration: 5.4min
completed: 2026-02-06
---

# Phase 2 Plan 2: Role-Based Stats Handlers and Company Filter UI Summary

**API handlers route to role-appropriate queries, /api/companies protected, and support users get company filter dropdown**

## Performance

- **Duration:** 5.4 min
- **Started:** 2026-02-06T14:19:08Z
- **Completed:** 2026-02-06T14:24:29Z
- **Tasks:** 3
- **Files created:** 1
- **Files modified:** 3

## Accomplishments
- Created api/handlers/stats.go with GetTaskStats and GetCallStats handlers
- Handlers route to correct query based on user.Role (admin → ByCompany, manager → ByManager, support → filtered, agent → own)
- Protected /api/companies endpoint with RequireRole middleware (admin, manager, supervisor, support only)
- Added company filter dropdown to dashboard-stats.html (hidden by default)
- Implemented loadCompanies() to populate filter from /api/companies
- Implemented loadStatsForCompany() to fetch stats with optional company_id parameter
- Company filter only shown for support role users

## Task Commits

Each task was committed atomically:

1. **Task 1: Create role-based stats handlers** - `97c2ef0` (feat)
2. **Task 2: Protect /api/companies endpoint** - `845ca23` (feat)
3. **Task 3: Add company filter dropdown to stats page UI** - `8956f76` (feat)

## Files Created/Modified
- `api/handlers/stats.go` - Created with GetTaskStats and GetCallStats handlers (role-based routing)
- `api/main.go` - Added statsHandler instance, registered /api/stats routes, protected /api/companies
- `app/dashboard-stats.html` - Added company filter dropdown container
- `app/src/dashboard-stats.js` - Added loadCompanies(), loadStatsForCompany(), updateStatsDisplay()

## Decisions Made
- **Role-based routing in handlers:** Each handler checks user.Role and calls appropriate query function (GetTaskStatsByCompany, GetTaskStatsByManager, etc.)
- **Support requires company_id:** Support role must provide company_id parameter to stats endpoints (never returns unfiltered all-companies data)
- **Role middleware on /api/companies:** Protected companies endpoint so agent role cannot access company list
- **Conditional UI rendering:** Company filter dropdown only shown when user.role === 'support'
- **Stats loaded on init:** Non-support roles load stats immediately, support waits for company selection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**1. [Rule 1 - Bug] Incorrect parameter types for manager queries**
- **Found during:** Task 1 (go build after initial handler creation)
- **Issue:** GetTaskStatsByManagerParams and GetCallStatsByManagerParams expect ReportsTo as sql.NullInt32, but I passed user.ID (int32) directly
- **Fix:** Wrapped user.ID in sql.NullInt32{Int32: user.ID, Valid: true}
- **Files modified:** api/handlers/stats.go (lines 65, 179)
- **Verification:** go build succeeded after fix
- **Committed in:** 97c2ef0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix was necessary for Go compilation. No scope creep.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- API handlers ready for real-time stats streaming (Phase 4)
- Company filter UI ready for support role testing
- Role-based access control enforced at API layer

**Blocker check:** None - all handlers compile and routes registered

---
*Phase: 02-role-based-data-layer*
*Completed: 2026-02-06*
