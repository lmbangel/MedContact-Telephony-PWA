---
phase: 04-dashboard-ui-summary-cards
plan: 01
subsystem: api
tags: [go, sqlc, mysql, http-handlers, role-based-access]

# Dependency graph
requires:
  - phase: 03-core-metrics-time-filtering
    provides: "Time filter patterns, role-based query structure with recursive CTEs"
provides:
  - "/api/stats/agents endpoint returning per-agent breakdown"
  - "20 SQL queries for per-agent call and task metrics (company/manager × today/yesterday/this_week/this_month/custom)"
  - "GetAgentBreakdown HTTP handler with role-based routing"
  - "AgentBreakdown struct combining call and task stats"
affects: [04-02, 04-03, DISP-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-agent aggregation using LEFT JOIN with GROUP BY on users table"
    - "Merging call and task stats by agent_id in Go handler"
    - "Type switch pattern for handling multiple sqlc-generated row types"

key-files:
  created: []
  modified:
    - api/queries.sql
    - api/db/queries.sql.go
    - api/handlers/stats.go
    - api/main.go

key-decisions:
  - "LEFT JOIN ensures all active users appear in results even with zero calls/tasks"
  - "Type switch for merging stats handles all time filter row types separately"
  - "Agent role returns empty array - no access to per-agent breakdown"

patterns-established:
  - "Per-agent queries follow Phase 3 patterns: separate query per time filter, recursive CTEs for managers, is_active filtering"
  - "Merging pattern: fetch call stats + task stats, merge by agent_id in Go"

# Metrics
duration: 3min
completed: 2026-02-10
---

# Phase 4 Plan 01: Backend API for Agent Breakdown Summary

**Per-agent breakdown API endpoint at /api/stats/agents returns individual agent metrics with role-based filtering using 20 SQL queries and merging handler**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-10T14:23:53Z
- **Completed:** 2026-02-10T14:27:53Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- New /api/stats/agents endpoint accessible to admin, manager, supervisor, support roles
- 20 SQL queries for per-agent call and task breakdown with 5 time filters each
- GetAgentBreakdown handler merges call and task stats by agent_id
- Role-based routing: admin sees all company agents, managers see subordinates via recursive CTEs

## Task Commits

Each task was committed atomically:

1. **Task 1: Add per-agent SQL queries with role-based filtering** - `24d5ac1` (feat)
2. **Task 2: Create GetAgentBreakdown HTTP handler** - `97c1801` (feat)
3. **Task 3: Register agent breakdown route** - `114e9cf` (feat)

## Files Created/Modified
- `api/queries.sql` - 20 per-agent queries (GetCallStatsByAgentForCompany*, GetTaskStatsByAgentForCompany*, GetCallStatsByAgentForManager*, GetTaskStatsByAgentForManager*)
- `api/db/queries.sql.go` - sqlc-generated Go methods for all queries
- `api/handlers/stats.go` - GetAgentBreakdown handler, AgentBreakdown struct, getAgentBreakdownForCompany/Manager helpers, mergeAgentStats utility
- `api/main.go` - Route registration for /api/stats/agents

## Decisions Made

**1. LEFT JOIN for complete agent roster**
- Used LEFT JOIN on users table to ensure all active users appear in results
- Rationale: Managers/admins should see all team members even if they have zero activity
- Alternative considered: INNER JOIN would exclude inactive agents, but would also hide agents with no data

**2. Type switch for multi-type merging**
- mergeAgentStats uses type switch to handle 10 different row types from sqlc
- Rationale: Each time filter generates different Go struct, explicit type switch is type-safe
- Alternative considered: Interface{} reflection would be brittle, type switches catch missing types at compile time

**3. Agent role sees empty array**
- Agent role returns empty breakdown array, no access to peer metrics
- Rationale: Maintains role-based access control principle from Phase 2
- Follows Phase 3 pattern where agents only see own stats

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation followed Phase 3 established patterns smoothly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 4 Plan 02:** Frontend UI can now fetch per-agent breakdown data via /api/stats/agents endpoint.

**API response structure:**
```json
{
  "success": true,
  "agents": [
    {
      "agent_id": 1,
      "firstname": "John",
      "lastname": "Doe",
      "agent_identifier": "agent001",
      "total_calls": 42,
      "answered_calls": 38,
      "missed_calls": 4,
      "avg_duration": 125.5,
      "total_tasks": 15,
      "pending_tasks": 3,
      "in_progress_tasks": 2,
      "completed_tasks": 10
    }
  ]
}
```

**Supports all time filters:**
- `GET /api/stats/agents?filter_type=today`
- `GET /api/stats/agents?filter_type=yesterday`
- `GET /api/stats/agents?filter_type=this_week`
- `GET /api/stats/agents?filter_type=this_month`
- `GET /api/stats/agents?filter_type=custom&start_date=2026-02-01&end_date=2026-02-07`

**Role-based behavior:**
- Admin: All company agents
- Manager/Supervisor: Direct/indirect reports only
- Support: Requires `company_id` parameter
- Agent: Empty array

---
*Phase: 04-dashboard-ui-summary-cards*
*Completed: 2026-02-10*
