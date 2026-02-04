# Requirements: MedContact Stats Page

**Defined:** 2026-02-03
**Core Value:** Managers can see real-time performance data for the agents they're responsible for

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Navigation

- [ ] **NAV-01**: Stats page accessible via side-stats-icon button click
- [ ] **NAV-02**: Unauthorized roles redirected away from stats page

### Role-Based Access

- [ ] **ROLE-01**: Admin users see all agents in their company
- [ ] **ROLE-02**: Manager/Supervisor users see agents who report to them
- [ ] **ROLE-03**: Support users see all companies and agents
- [ ] **ROLE-04**: Company filter dropdown for support role
- [ ] **ROLE-05**: Agent filter within user's allowed scope

### Call Metrics

- [ ] **CALL-01**: Display total calls count
- [ ] **CALL-02**: Display answered vs missed calls breakdown
- [ ] **CALL-03**: Display average call duration
- [ ] **CALL-04**: Aggregate calls by selected time period

### Task Metrics

- [ ] **TASK-01**: Display tasks assigned count
- [ ] **TASK-02**: Display tasks completed count
- [ ] **TASK-03**: Display tasks pending/overdue count

### Outcome Metrics

- [ ] **OUTC-01**: Display resolution count
- [ ] **OUTC-02**: Display follow-up scheduled count
- [ ] **OUTC-03**: Display escalation count

### Activity Metrics

- [ ] **ACTV-01**: Display hours online/logged in
- [ ] **ACTV-02**: Display active time on calls/tasks

### Time Filtering

- [ ] **TIME-01**: Today/Yesterday quick filter buttons
- [ ] **TIME-02**: This week/This month quick filter buttons
- [ ] **TIME-03**: Custom date range picker

### Display

- [ ] **DISP-01**: Summary cards showing key metrics
- [ ] **DISP-02**: Per-agent breakdown table
- [ ] **DISP-03**: Trend charts showing metrics over time

### Real-Time

- [ ] **REAL-01**: SSE connection for live stats updates
- [ ] **REAL-02**: Auto-reconnection on SSE disconnect

### Export

- [ ] **EXPRT-01**: CSV download of current stats view

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Export

- **EXPRT-02**: Excel (.xlsx) download with formatting

### Alerts

- **ALRT-01**: Configurable threshold alerts
- **ALRT-02**: Email notifications for KPI breaches

### Analytics

- **ANLY-01**: Predictive analytics for call volume
- **ANLY-02**: Sentiment analysis integration

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| WebSocket implementation | SSE sufficient for one-way server-to-client updates |
| Individual agent dashboard changes | Focus on new stats page only |
| Mobile-specific layout | Existing responsive patterns sufficient |
| Real-time chat/messaging | Not related to stats functionality |
| Historical data archiving | Database handles this already |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | TBD | Pending |
| NAV-02 | TBD | Pending |
| ROLE-01 | TBD | Pending |
| ROLE-02 | TBD | Pending |
| ROLE-03 | TBD | Pending |
| ROLE-04 | TBD | Pending |
| ROLE-05 | TBD | Pending |
| CALL-01 | TBD | Pending |
| CALL-02 | TBD | Pending |
| CALL-03 | TBD | Pending |
| CALL-04 | TBD | Pending |
| TASK-01 | TBD | Pending |
| TASK-02 | TBD | Pending |
| TASK-03 | TBD | Pending |
| OUTC-01 | TBD | Pending |
| OUTC-02 | TBD | Pending |
| OUTC-03 | TBD | Pending |
| ACTV-01 | TBD | Pending |
| ACTV-02 | TBD | Pending |
| TIME-01 | TBD | Pending |
| TIME-02 | TBD | Pending |
| TIME-03 | TBD | Pending |
| DISP-01 | TBD | Pending |
| DISP-02 | TBD | Pending |
| DISP-03 | TBD | Pending |
| REAL-01 | TBD | Pending |
| REAL-02 | TBD | Pending |
| EXPRT-01 | TBD | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 0
- Unmapped: 28 ⚠️

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-03 after initial definition*
