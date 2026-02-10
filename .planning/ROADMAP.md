# Roadmap: MedContact Stats Page

## Overview

This roadmap delivers a supervisor/manager stats dashboard to the existing MedContact telephony PWA. The journey builds from secure real-time infrastructure through role-based data aggregation to visualization and export capabilities. Each phase adds coherent, verifiable capabilities while addressing critical pitfalls identified in research (SSE memory leaks, role-based access bypass, query performance collapse).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: SSE Infrastructure & Navigation** - Real-time foundation with connection management
- [x] **Phase 2: Role-Based Data Layer** - Security-critical SQL aggregation with role filtering
- [x] **Phase 3: Core Metrics & Time Filtering** - Stats aggregation for calls, tasks, outcomes, activity
- [x] **Phase 4: Dashboard UI & Summary Cards** - Basic stats page with key metrics display
- [ ] **Phase 5: Chart Visualization** - Trend charts with incremental updates
- [ ] **Phase 6: Export & Polish** - CSV export and final enhancements

## Phase Details

### Phase 1: SSE Infrastructure & Navigation
**Goal**: Users can access stats page and receive real-time updates without memory leaks
**Depends on**: Nothing (first phase)
**Requirements**: REAL-01, REAL-02, NAV-01, NAV-02
**Success Criteria** (what must be TRUE):
  1. User can click side-stats-icon button to open stats page
  2. Unauthorized roles are redirected away from stats page
  3. SSE connection establishes and receives heartbeat pings
  4. SSE auto-reconnects when connection drops
  5. Memory usage stays stable over 4-hour session (under 200MB)
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Backend SSE infrastructure with role-based auth middleware
- [x] 01-02-PLAN.md — Stats page frontend with SSE client and connection indicator
- [x] 01-03-PLAN.md — Wire sidebar navigation and verify full flow

### Phase 2: Role-Based Data Layer
**Goal**: Database queries enforce role-based visibility at SQL level
**Depends on**: Phase 1
**Requirements**: ROLE-01, ROLE-02, ROLE-03, ROLE-04, ROLE-05
**Success Criteria** (what must be TRUE):
  1. Admin user API calls return only agents in their company
  2. Manager/supervisor API calls return only agents who report to them
  3. Support user API calls return all companies and agents
  4. Support user can filter by company via dropdown
  5. All users can filter agents within their allowed scope
  6. Unauthorized data never reaches client (verified at SQL level)
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Add role-based SQL queries with WHERE clauses and recursive CTEs
- [x] 02-02-PLAN.md — Update API handlers with role routing and add company filter UI
- [x] 02-03-PLAN.md — Verify role-based access control blocks unauthorized data

### Phase 3: Core Metrics & Time Filtering
**Goal**: Backend aggregates call, task, outcome, and activity metrics for filtered time periods
**Depends on**: Phase 2
**Requirements**: CALL-01, CALL-02, CALL-03, CALL-04, TASK-01, TASK-02, TASK-03, OUTC-01, OUTC-02, OUTC-03, ACTV-01, ACTV-02, TIME-01, TIME-02, TIME-03
**Success Criteria** (what must be TRUE):
  1. API returns total calls, answered/missed breakdown, and average duration
  2. API returns tasks assigned, completed, and pending/overdue counts
  3. API returns resolution, follow-up, and escalation counts
  4. API returns hours online and active time on calls/tasks
  5. User can filter stats by today, yesterday, this week, this month
  6. User can select custom date range
  7. Stats update when time filter changes
  8. Queries complete in under 1 second with 10k+ records
**Plans**: 4 plans (3 original + 1 gap closure)

Plans:
- [x] 03-01-PLAN.md — Database indexes and time-filtered call/task queries
- [x] 03-02-PLAN.md — Activity tracking queries and handler time routing
- [x] 03-03-PLAN.md — Time filter UI with quick buttons and custom range picker
- [x] 03-04-PLAN.md — Activity stats handler and frontend integration (gap closure)

### Phase 4: Dashboard UI & Summary Cards
**Goal**: Stats page displays key metrics in summary cards with role-appropriate filtering
**Depends on**: Phase 3
**Requirements**: DISP-01, DISP-02
**Success Criteria** (what must be TRUE):
  1. Stats page displays 4-6 summary cards with key metrics
  2. Summary cards show current values for selected time period
  3. Per-agent breakdown table displays with sortable columns
  4. Time period selector updates all displays
  5. Role-based filters work correctly (company/agent dropdowns)
  6. Loading states display during data fetch
  7. Stats page follows existing Tailwind CSS patterns
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Per-agent breakdown API endpoint with role-based filtering
- [x] 04-02-PLAN.md — Dashboard UI with loading states and sortable agent table

### Phase 5: Chart Visualization
**Goal**: Trend charts display metrics over time with real-time updates
**Depends on**: Phase 4
**Requirements**: DISP-03
**Success Criteria** (what must be TRUE):
  1. Line charts show call volume trends over selected time period
  2. Bar charts show agent performance comparisons
  3. Charts update incrementally via SSE (no full recreation)
  4. Chart memory usage stays stable over 4-hour session
  5. Charts are responsive and render correctly on mobile
**Plans**: TBD

Plans:
- [ ] 05-01: TBD during plan-phase

### Phase 6: Export & Polish
**Goal**: Users can export stats to CSV and dashboard is production-ready
**Depends on**: Phase 5
**Requirements**: EXPRT-01
**Success Criteria** (what must be TRUE):
  1. User can download current stats view as CSV file
  2. CSV export includes all visible data with proper formatting
  3. Export processing happens client-side (zero server load)
  4. Offline indicator displays when SSE disconnects
  5. Timezone indicator shows what timezone times are displayed in
**Plans**: TBD

Plans:
- [ ] 06-01: TBD during plan-phase

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. SSE Infrastructure & Navigation | 3/3 | Complete | 2026-02-06 |
| 2. Role-Based Data Layer | 3/3 | Complete | 2026-02-08 |
| 3. Core Metrics & Time Filtering | 4/4 | Complete | 2026-02-09 |
| 4. Dashboard UI & Summary Cards | 2/2 | Complete | 2026-02-10 |
| 5. Chart Visualization | 0/TBD | Not started | - |
| 6. Export & Polish | 0/TBD | Not started | - |
