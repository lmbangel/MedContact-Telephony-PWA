# MedContact Stats Page

## What This Is

A supervisor/manager stats dashboard for the MedContact Telephony PWA that provides role-based visibility into team performance metrics. Supervisors see their direct reports, admins see their entire company, and support staff can monitor all companies across the platform.

## Core Value

Managers can see real-time performance data for the agents they're responsible for, enabling data-driven team oversight without requiring manual reporting.

## Requirements

### Validated

- ✓ Go backend with chi router and MySQL database — existing
- ✓ Frontend SPA with Vanilla JS and Vite — existing
- ✓ Twilio Voice SDK integration for call handling — existing
- ✓ User authentication with session-based auth — existing
- ✓ Dashboard home page with individual agent stats — existing
- ✓ Call tracking and logging to database — existing
- ✓ Task management (CRUD, stats) — existing
- ✓ Customer information lookup — existing
- ✓ Multi-tenant company structure — existing
- ✓ User roles in database — existing
- ✓ Reporting relationships (manager_id field) — existing

### Active

- [ ] Stats page accessible via side-stats-icon button
- [ ] Role-based visibility (admin sees company, manager sees reports, support sees all)
- [ ] Call metrics aggregation (total calls, duration, answered/missed)
- [ ] Task completion stats (assigned, completed, pending)
- [ ] Customer outcome stats (resolutions, follow-ups, escalations)
- [ ] Activity/login time tracking (hours online, active time)
- [ ] Time period filtering (today, yesterday, week, month, custom range)
- [ ] Summary cards displaying key metrics
- [ ] Charts/graphs showing trends over time
- [ ] Detailed table view with per-agent breakdown
- [ ] SSE for real-time stats updates
- [ ] Company filter for support role
- [ ] Agent filter within allowed scope
- [ ] CSV/Excel export functionality

### Out of Scope

- WebSocket implementation — using SSE for simpler one-way updates
- Individual agent dashboard changes — focus on new stats page only
- Predictive analytics — v2 feature
- Automated alerts/notifications — v2 feature
- Mobile-specific layout — existing responsive patterns sufficient

## Context

This is a brownfield project adding a new page to an existing telephony PWA. The codebase has:
- Established patterns: service classes (AuthService, TwilioService), observable stores (CallStore)
- Existing stats endpoints: `/api/calls/stats`, `/api/tasks/stats` for individual agents
- Role field on users table with admin, manager, supervisor, support values
- Reporting structure via manager_id/reports_to field on users

The current dashboard-home.js shows individual agent stats. The new stats page extends this pattern but aggregates across teams/companies based on role.

## Constraints

- **Tech stack**: Must use existing Go backend + Vanilla JS frontend (no new frameworks)
- **Real-time**: SSE only (not WebSocket) for server-to-client updates
- **Database**: MySQL with sqlc for query generation
- **Auth pattern**: Existing session-based authentication
- **UI framework**: Tailwind CSS for styling consistency

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SSE over WebSocket | One-way server-to-client updates, simpler implementation | — Pending |
| Role-based filtering at API level | Security - clients shouldn't see unauthorized data | — Pending |
| Aggregate stats in database queries | Performance - don't fetch all records to client | — Pending |

---
*Last updated: 2026-02-03 after initialization*
