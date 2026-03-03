# Phase 2: Role-Based Data Layer - Research

**Researched:** 2026-02-06
**Domain:** Database access control, role-based authorization enforcement at SQL layer
**Confidence:** HIGH

## Summary

Phase 2 requires enforcing role-based visibility at the database query level using sqlc (type-safe SQL queries in Go). The codebase already has a foundational users table with role and company_id fields, and the goal is to filter all data queries (customers, tasks, calls, stats) based on authenticated user's role and company membership. This prevents unauthorized data from ever reaching the API client.

The architecture uses a "query parameter injection" pattern: every data access method receives the authenticated user context and includes role/company/supervisor filtering directly in SQL WHERE clauses. This is superior to application-level filtering because the database enforces constraints even if bypassed via direct SQL.

**Primary recommendation:** Implement filtering at the SQL layer by extending sqlc queries with WHERE conditions that check user.company_id, user.role, and user.reports_to hierarchy. Use recursive CTEs in MySQL 8.0 for manager subordinate queries. Never expose queries that lack these filters.

## Standard Stack

### Core Libraries
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sqlc | v1.30.0 | Type-safe SQL code generator | Used in codebase; generates compile-time validated queries |
| github.com/go-sql-driver/mysql | v1.9.3 | MySQL driver for Go | Standard Go MySQL driver; already in use |
| chi router | v5.2.3 | HTTP request routing | Used for all API routes; supports middleware |
| golang.org/x/crypto | v0.45.0 | Password hashing (bcrypt) | Standard for secure password handling |

### Database
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MySQL | 8.0+ | RDBMS with recursive CTE support | Already in use; required for manager hierarchy queries |
| - | - | Recursive CTE (WITH RECURSIVE) | Querying manager-subordinate hierarchies |

### Patterns Used in Codebase
- Session-based authentication with cookie storage
- Type-generated database models from sqlc
- Middleware for route-level role checking (chi middleware chain)
- Queries organized in separate db package with generated code from sqlc

### No Alternatives
The project is committed to sqlc and chi for this phase—alternatives like ORMs or hand-rolled queries are out of scope.

## Architecture Patterns

### Data Layer Authorization Pattern

The standard pattern for role-based filtering in this codebase is:

```
User Request → Chi Middleware (role check) → Handler → DB Query with filters → Response
                (session/auth)              (route)   (user context in query)
```

**Filter location:** SQL WHERE clause, not application code
**Scope:** All data-returning queries must include authorization WHERE conditions

### Query Structure for Each Role

#### Admin Role
**What:** Admin sees all agents (users) in their company only
**SQL Pattern:**
```sql
SELECT * FROM users
WHERE company_id = ? AND role IN ('admin', 'manager', 'supervisor', 'agent')
```
**Parameter:** User's own company_id

#### Manager/Supervisor Role
**What:** Manager sees direct reports only (agents who have reports_to = manager's user_id)
**SQL Pattern:**
```sql
-- For direct reports
SELECT * FROM users
WHERE reports_to = ? AND company_id = ?
```
**Requires:** Recursive CTE if you need "all descendants" (manager's reports AND their subordinates)
```sql
WITH RECURSIVE subordinates AS (
    SELECT id FROM users WHERE reports_to = ?
    UNION ALL
    SELECT u.id FROM users u
    JOIN subordinates s ON u.reports_to = s.id
)
SELECT * FROM users WHERE id IN (SELECT id FROM subordinates)
```

#### Support Role
**What:** Support sees all companies and all agents in the system (no filtering)
**SQL Pattern:**
```sql
SELECT * FROM users  -- No WHERE clause filtering, return all
```
**Company filter UI:** Support gets a dropdown to filter by company in the client (but data access is unrestricted)

#### Customer/Task/Call Filtering by Role

All data tables must inherit the authorization from the owning user/agent:

**Customers by role:**
- Admin: WHERE company_id = ?
- Manager: WHERE company_id = ? (via agents in their supervision hierarchy)
- Support: All (no filter)
- Agent: Their own customers OR customers in calls they've handled

**Tasks by role:**
- Admin: WHERE assigned_to IN (agents from their company)
- Manager: WHERE assigned_to IN (subordinates from recursive CTE)
- Support: All tasks
- Agent: Only tasks assigned to them

**Calls/Transcriptions by role:**
- Admin: WHERE agent_id IN (users from their company)
- Manager: WHERE agent_id IN (subordinates)
- Support: All calls
- Agent: Only calls where agent_id = current_user

### SQL Query Patterns with sqlc

**Pattern 1: Company-scoped query (Admin)**
```sql
-- queries.sql
-- name: GetUsersByCompany :many
SELECT u.* FROM users u
WHERE u.company_id = ?
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetCustomersByCompany :many
SELECT c.* FROM customers c
WHERE c.company_id = ?
ORDER BY c.first_name ASC;

-- name: GetTasksByCompanyUsers :many
SELECT t.* FROM tasks t
JOIN users u ON t.assigned_to = u.id
WHERE u.company_id = ?
ORDER BY t.created_at DESC;
```

Handler usage:
```go
// Gets authenticated user's company_id from session
user, _ := s.queries.GetUserByID(ctx, sessionUserID)
tasks, _ := s.queries.GetTasksByCompanyUsers(ctx, user.CompanyID)
```

**Pattern 2: Manager hierarchy query (Manager/Supervisor)**
```sql
-- queries.sql
-- name: GetManagerSubordinates :many
WITH RECURSIVE subordinates AS (
    SELECT id, firstname, lastname, agent_id, company_id, role
    FROM users
    WHERE reports_to = ? AND company_id = ?
    UNION ALL
    SELECT u.id, u.firstname, u.lastname, u.agent_id, u.company_id, u.role
    FROM users u
    JOIN subordinates s ON u.reports_to = s.id
)
SELECT * FROM subordinates
ORDER BY firstname ASC;

-- name: GetTasksByManager :many
WITH RECURSIVE subordinates AS (
    SELECT id FROM users
    WHERE reports_to = ? AND company_id = ?
    UNION ALL
    SELECT u.id FROM users u
    JOIN subordinates s ON u.reports_to = s.id
)
SELECT t.* FROM tasks t
WHERE t.assigned_to IN (SELECT id FROM subordinates)
ORDER BY t.created_at DESC;
```

Handler usage:
```go
user, _ := s.queries.GetUserByID(ctx, sessionUserID)
tasks, _ := s.queries.GetTasksByManager(ctx, user.ID, user.CompanyID)
```

**Pattern 3: Role-aware queries with parameter**
```sql
-- name: GetAgentsByRole :many
SELECT * FROM users
WHERE company_id = ? AND role = ?
ORDER BY firstname ASC;

-- name: GetCallsByAgent :many
SELECT t.* FROM transcriptions t
WHERE t.agent_id = ? AND t.company_id = ?
ORDER BY t.created_at DESC;
```

### Important Implementation Details

1. **Parameter order in sqlc:** Always include filtering parameters FIRST before limit/offset
   ```sql
   -- Correct
   WHERE company_id = ? AND role = ?
   LIMIT ? OFFSET ?

   -- Avoid
   LIMIT ? OFFSET ? WHERE company_id = ?  -- Invalid syntax
   ```

2. **Nullable filters:** Use `sql.NullInt32` in Go when optional filtering is needed
   ```go
   type GetTasksFilteredParams struct {
       CompanyID sql.NullInt32
       ManagerID sql.NullInt32
       Status sql.NullString
   }
   ```

3. **Index performance:** Ensure indexes exist on all filter columns
   - `idx_company_id` on users, customers, tasks, transcriptions
   - `idx_role` on users
   - `idx_reports_to` on users
   - `idx_agent_id` on transcriptions
   - `idx_assigned_to` on tasks

4. **Recursive CTE depth limit:** Add `UNION ALL` safeguard or LIMIT iterations
   ```sql
   WITH RECURSIVE subordinates AS (
       SELECT id, 0 as depth FROM users WHERE reports_to = ?
       UNION ALL
       SELECT u.id, s.depth + 1 FROM users u
       JOIN subordinates s ON u.reports_to = s.id
       WHERE s.depth < 10  -- Prevent infinite loops, max 10 levels
   )
   ```

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authorization checking | Custom if/switch on user.Role in handlers | WHERE clauses in SQL queries | Database enforces constraints even if application is bypassed; single source of truth |
| Manager hierarchy queries | Loop through users and check reports_to recursively in Go | MySQL WITH RECURSIVE CTE | Efficient (1 query), avoids N+1 problem, index-optimized |
| Company-scoped multi-table queries | Fetch all rows then filter in Go | WHERE company_id = ? in every query | Database returns only authorized rows; network efficient; scales better |
| Access control verification | Application-level audit trail | Add audit columns to queries (who, when, what) | Compliance requirement; prevents unauthorized access from being hidden |

**Key insight:** Role-based access at the SQL level is NOT optional complexity—it's the only way to guarantee data security at scale. Application filtering has failure modes: forgotten checks, code paths, API direct access, admin tools, exports, backups.

## Common Pitfalls

### Pitfall 1: Filtering Only Top-Level Queries
**What goes wrong:** You add company_id filtering to GetCustomers but forget to filter GetCustomersByPhone, GetCallsByCustomer, or stats queries. Attacker calls forgotten endpoint and accesses unauthorized data.
**Why it happens:** Developers filter the obvious routes but miss edge cases, filters, and stat aggregations.
**How to avoid:** Create a checklist of ALL queries in queries.sql, mark each with required filters, review before code generation. Use a test suite that verifies unauthorized users get 403/empty results.
**Warning signs:** API endpoint accepts customer_id parameter without validating user has access to that customer's company.

### Pitfall 2: Support Role Given Wrong Scoping
**What goes wrong:** Support role intended to see "all companies" but is given a company_id filter by mistake, breaking their ability to support multiple organizations.
**Why it happens:** Copy-pasting filter logic without reading requirements or misunderstanding "support" scope.
**How to avoid:** Support queries should have NO WHERE company_id clause. Document this explicitly in queries.sql comments. Test that support user queries return data from all companies.
**Warning signs:** Support users report "missing company X" data; queries return 0 rows unexpectedly.

### Pitfall 3: Manager Queries Missing Recursive CTE
**What goes wrong:** Manager hierarchy query only checks direct reports (reports_to = manager_id) and misses nested manager structure (manager's subordinates' subordinates). User assigned to lower manager can only see immediate team.
**Why it happens:** Simple JOIN feels adequate for "manager sees reports" but doesn't handle organization depth.
**How to avoid:** If org has multiple management levels, REQUIRE recursive CTE. Use the WITH RECURSIVE pattern in all manager queries. Test with 2-level and 3-level hierarchies.
**Warning signs:** Manager reports "missing tasks from team member's team"; supervisor can't see indirect reports.

### Pitfall 4: Stats Queries Not Filtered
**What goes wrong:** GetTaskStats returns aggregate counts for ALL agents instead of filtered subset. Admin sees company-wide stats (correct) but aggregations aren't scoped.
**Why it happens:** Aggregate queries feel "harmless" but leak information about unauthorized records.
**How to avoid:** Every SELECT with aggregate functions (COUNT, SUM, AVG) must have the same WHERE filtering as detail queries. If detail query filters by company, aggregates must too.
**Warning signs:** Admin sees correct total but stats API returns higher numbers; unauthorized role gets non-zero counts.

### Pitfall 5: Forgetting Dual Filtering (Company AND Role)
**What goes wrong:** Query checks company_id correctly but doesn't verify user.role is allowed to see that data. Custom integration where admin shouldn't see support-only data.
**Why it happens:** Assuming "company_id filter is enough" without reading all requirements.
**How to avoid:** Document query intent in SQL comments. Example:
```sql
-- name: GetCallStats :one
-- Only accessible to agents, managers, admins in the agent's company
SELECT ... FROM transcriptions
WHERE agent_id = ? AND company_id = ?
```
**Warning signs:** Higher-privilege role (admin) can access lower-privilege data (internal notes).

## Code Examples

### Example 1: Basic Company-Scoped Handler

```go
// Source: Codebase pattern in main.go getCustomers handler
func (s *Server) getCustomersByCompany(w http.ResponseWriter, r *http.Request) {
	// Extract authenticated user
	cookie, err := r.Cookie("session_id")
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	session, err := s.queries.GetSession(r.Context(), cookie.Value)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Session expired")
		return
	}

	user, err := s.queries.GetUserByID(r.Context(), session.UserID)
	if err != nil {
		respondError(w, http.StatusNotFound, "User not found")
		return
	}

	// Query with user's company_id filter
	customers, err := s.queries.GetCustomersByCompany(r.Context(), user.CompanyID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get customers")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"customers": customers,
	})
}
```

SQL query (queries.sql):
```sql
-- name: GetCustomersByCompany :many
SELECT * FROM customers
WHERE company_id = ?
ORDER BY first_name ASC, last_name ASC;
```

### Example 2: Manager Hierarchy with Recursive CTE

```go
// Source: Recommended pattern for manager role
func (s *Server) getTasksByManager(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_id")
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	session, err := s.queries.GetSession(r.Context(), cookie.Value)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Session expired")
		return
	}

	user, err := s.queries.GetUserByID(r.Context(), session.UserID)
	if err != nil {
		respondError(w, http.StatusNotFound, "User not found")
		return
	}

	// Only managers/supervisors can use this
	if user.Role != "manager" && user.Role != "supervisor" {
		respondError(w, http.StatusForbidden, "Only managers can view team tasks")
		return
	}

	// Get all subordinates (recursive) and their tasks
	tasks, err := s.queries.GetTasksByManager(r.Context(), user.ID, user.CompanyID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get tasks")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"tasks":   tasks,
	})
}
```

SQL query (queries.sql):
```sql
-- name: GetTasksByManager :many
WITH RECURSIVE subordinates AS (
    SELECT id FROM users
    WHERE reports_to = ? AND company_id = ? AND is_active = 1
    UNION ALL
    SELECT u.id FROM users u
    JOIN subordinates s ON u.reports_to = s.id
    WHERE u.is_active = 1
)
SELECT t.* FROM tasks t
WHERE t.assigned_to IN (SELECT id FROM subordinates)
ORDER BY t.created_at DESC;
```

### Example 3: Role-Aware Query Wrapper

```go
// Source: Pattern for multiple roles with different logic
func (s *Server) getTaskStats(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_id")
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	session, err := s.queries.GetSession(r.Context(), cookie.Value)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Session expired")
		return
	}

	user, err := s.queries.GetUserByID(r.Context(), session.UserID)
	if err != nil {
		respondError(w, http.StatusNotFound, "User not found")
		return
	}

	var stats *db.GetTaskStatsRow
	var err error

	// Route to appropriate query based on role
	switch user.Role {
	case "admin":
		// Admin gets stats for all agents in their company
		stats, err = s.queries.GetTaskStatsByCompany(r.Context(), user.CompanyID)
	case "manager", "supervisor":
		// Manager gets stats for their subordinates only
		stats, err = s.queries.GetTaskStatsByManager(r.Context(), user.ID, user.CompanyID)
	case "support":
		// Support gets system-wide stats
		stats, err = s.queries.GetTaskStatsAllCompanies(r.Context())
	case "agent":
		// Agent gets their own stats
		stats, err = s.queries.GetTaskStats(r.Context(), user.ID)
	default:
		respondError(w, http.StatusForbidden, "Unknown role")
		return
	}

	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get task stats")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"stats":   stats,
	})
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Application-level role check in handler | SQL WHERE filters + middleware role check | sqlc adoption (2024+) | More secure, database-enforced, prevents bypasses |
| OWASP A05 (2021) broken access control | OWASP A01 (2025) elevated—still #1 priority | 2025 list update | Industry acknowledgement; compliance now requires SQL-level enforcement |
| Support manually filters each query | Generated sqlc queries with WHERE built-in | Modern sqlc usage (2025+) | Type safety, compile-time verification of filters |
| Manager queries with JOIN only | Recursive CTE for hierarchy depth | MySQL 8.0+ adoption | Handles multi-level hierarchies correctly |

**Deprecated/outdated:**
- Application-only filtering: Still common but insecure; single point of failure
- No company_id on all tables: Previous schema without multi-tenancy; migrate by backfill data

## Open Questions

1. **Support Role Data Access Scope**
   - What we know: Support users can see all companies and agents; they have a dropdown to filter by company in UI
   - What's unclear: Should support users see customer PII? Internal notes? Medical aid information? Need requirements clarification.
   - Recommendation: Define support data classification (read-only, aggregates only, redacted PII). If support needs customer data, create explicit GetCustomersSupport query with appropriate WHERE/SELECT columns.

2. **Audit Trail for Authorization**
   - What we know: Phase requires "unauthorized data never reaches client (verified at SQL level)"
   - What's unclear: Do we need to log failed authorization attempts? Who accessed what data when?
   - Recommendation: Add created_by and accessed_by columns to audit-critical tables (customers, tasks, calls). Consider separate audit_log table.

3. **Cross-Company Use Cases**
   - What we know: Current schema has company_id on users, customers, calls
   - What's unclear: Can a user belong to multiple companies? Can a customer be served by multiple companies?
   - Recommendation: Out of scope for Phase 2. Assume 1:N (one user, one company). If multi-company users needed, add mapping table in Phase 3.

4. **Stats Aggregation Performance**
   - What we know: Recursive CTE can be expensive with large hierarchies
   - What's unclear: What's the maximum org depth? How many agents per company? Query timeouts?
   - Recommendation: Monitor slow queries. Pre-aggregate if stats become bottleneck (e.g., cache manager task counts).

## Sources

### Primary (HIGH confidence)
- **Codebase schema.sql and queries.sql** - Current authorization table structure, existing query patterns
- **Go chi router middleware documentation** - Role-based middleware pattern verified in middleware/role.go
- **MySQL 8.0 official documentation** - Recursive CTE syntax for hierarchical queries
- **sqlc v1.30.0 documentation** (https://docs.sqlc.dev/) - Type-safe query generation, WHERE clause handling

### Secondary (MEDIUM confidence)
- [AWS Row-Level Security in Aurora MySQL](https://aws.amazon.com/blogs/database/implement-row-level-security-in-amazon-aurora-mysql-and-amazon-rds-for-mysql/) - View-based filtering patterns
- [OWASP Top 10 2025 - Broken Access Control](https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control/) - Authorization requirements
- [LearnSQL Hierarchical Queries](https://learnsql.com/blog/query-parent-child-tree/) - Manager-subordinate relationship patterns
- [How to Use sqlc for Type-Safe Database Access](https://oneuptime.com/blog/post/2026-01-07-go-sqlc-type-safe-database/view) - sqlc patterns

### Tertiary (LOW confidence - WebSearch only)
- Generic RBAC tutorials (not project-specific)
- Community blog posts on sqlc authorization (unverified)

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - Codebase uses sqlc, chi, MySQL; versions verified in go.mod
- Architecture: HIGH - Patterns directly derived from existing codebase role.go and schema
- Pitfalls: MEDIUM - Based on common authorization patterns; need Phase 1 completion for full context
- SQL Examples: HIGH - All patterns use standard MySQL 8.0 syntax; recursive CTE syntax verified

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days for stable stack; update if MySQL or sqlc major version changes)

## Verification Checklist

Before Phase 2 tasks begin:

- [ ] All queries in queries.sql reviewed for authorization scope
- [ ] Test suite exists to verify unauthorized role gets 403/empty results
- [ ] Manager supervision hierarchy tested with 2+ levels
- [ ] Support role queries confirmed to return all companies
- [ ] Stats/aggregate queries checked for company/role filters
- [ ] Indexes created on all filter columns (company_id, role, reports_to, agent_id, assigned_to)
- [ ] Recursive CTE depth limit set (max 10 levels default, configurable)
- [ ] Code generation run: sqlc generate
- [ ] Compile check: go build succeeds
