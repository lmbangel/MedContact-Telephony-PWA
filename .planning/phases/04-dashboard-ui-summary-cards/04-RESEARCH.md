# Phase 4: Dashboard UI & Summary Cards - Research

**Researched:** 2026-02-10
**Domain:** Vanilla JavaScript + Tailwind CSS frontend visualization
**Confidence:** HIGH

## Summary

Phase 4 builds a functional dashboard UI for the stats page, displaying aggregated metrics in summary cards and a per-agent breakdown table. The research confirms:

1. **Foundation Ready**: Phase 3 provides complete backend API endpoints (tasks, calls, activity) with all time filters operational. Frontend skeleton exists in `dashboard-stats.html` and `dashboard-stats.js`.

2. **UI Pattern Established**: Existing code uses Tailwind CSS CDN with border-based button states and grid layouts. Summary cards follow the 6-column responsive pattern already in `updateStatsDisplay()` (lines 266-293 of dashboard-stats.js).

3. **Data Flow Complete**: `fetchStats()` (lines 205-247) calls 3 endpoints and `updateStatsDisplay()` renders results. Phase 4 replaces placeholder rendering with proper card components and adds the per-agent breakdown table.

4. **No Framework Needed**: Vanilla JavaScript with DOM manipulation is the established pattern. No build step, no component framework—just HTML templates and event listeners.

5. **Critical Implementation Detail**: Per-agent data requires NEW API endpoints that don't exist yet. Current endpoints return aggregate stats only. Phase 4 must decide: build per-agent endpoints or compute breakdown client-side from agent-level API calls.

**Primary recommendation:** Build per-agent endpoints in API layer to keep data aggregation at source of truth (database). Client handles rendering of breakdown table only.

## Standard Stack

### Frontend UI Framework
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | v3 (CDN) | Utility-first CSS | Already deployed via CDN in project; no build step required |
| Vanilla JavaScript | ES6+ | DOM manipulation | No framework overhead; SSE already uses vanilla JS; established in codebase |
| HTML5 | - | Semantic markup | Standard; used throughout existing pages |

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | - | Phase 4 uses only HTML + Tailwind + vanilla JS |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla JS DOM | Alpine.js | Alpine adds ~15KB but gives reactive state binding; not needed for non-real-time updates in Phase 4 |
| Tailwind CDN | PostCSS + npm | CDN simpler for PWA; npm build adds complexity; stick with CDN |
| Custom table | Data table library (DataTables.js) | DataTables adds sorting/filtering/pagination; Phase 4 spec shows "sortable columns" but not paging—vanilla approach with built-in sort is lighter |

**Installation:** No installation needed. Tailwind CDN already in `dashboard-stats.html` line 9.

## Architecture Patterns

### Recommended Project Structure

Current structure (Phase 3):
```
app/
├── dashboard-stats.html          # Main page (time filters in place)
└── src/
    ├── dashboard-stats.js        # JS controller (fetchStats, setActiveFilter)
    └── js/services/
        ├── AuthService.js        # Session management
        └── SSEService.js         # Real-time connection
```

Phase 4 additions:
```
app/
├── dashboard-stats.html          # Add: summary cards + per-agent table HTML
└── src/
    └── dashboard-stats.js        # Add: renderSummaryCards(), renderAgentTable(),
                                   #      sortable column handlers
```

No new files needed. Extend existing files.

### Pattern 1: Summary Cards Grid

**What:** Responsive grid of metric cards showing current values for selected time period.

**When to use:** Displaying KPIs that update when filters change.

**Example:**
```html
<!-- From Phase 3 updateStatsDisplay() - lines 266-293 -->
<!-- Phase 4 improves this with named cards and loading states -->

<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
  <div class="bg-white p-4 rounded-lg shadow border border-gray-200">
    <h3 class="text-sm font-medium text-gray-500">Total Calls</h3>
    <p class="text-2xl font-bold text-gray-900 mt-2">42</p>
    <!-- Phase 4: Add trend indicator (↑10% from yesterday) -->
  </div>
  <!-- More cards... -->
</div>
```

**Loading state pattern:**
```html
<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" id="statsCards">
  <!-- Phase 4: Initially hidden, shown after fetch completes -->
  <!-- Use role="status" for accessibility -->
</div>
<div id="statsLoading" class="flex items-center justify-center py-8">
  <svg class="animate-spin h-8 w-8 text-blue-600">...</svg>
</div>
```

Source: Existing Tailwind patterns in dashboard-home.html (lines 52-56 show animate-spin loading spinner).

### Pattern 2: Sortable Data Table

**What:** Table showing per-agent breakdown with clickable column headers for sorting.

**When to use:** Displaying many rows of data that need client-side filtering/sorting.

**Example:**
```html
<table class="w-full">
  <thead class="bg-gray-100 border-b border-gray-200">
    <tr>
      <th class="px-4 py-2 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200">
        Agent Name
        <span id="sortArrow-name" class="ml-1">↕</span>
      </th>
      <th class="px-4 py-2 text-right text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200">
        Calls
      </th>
    </tr>
  </thead>
  <tbody>
    <tr class="border-b border-gray-200 hover:bg-gray-50">
      <td class="px-4 py-3 text-sm text-gray-900">John Agent</td>
      <td class="px-4 py-3 text-right text-sm font-medium text-gray-900">15</td>
    </tr>
  </tbody>
</table>
```

**Sortable handler (vanilla JS):**
```javascript
// Phase 4 implementation pattern
let sortState = { column: 'name', direction: 'asc' };

function sortTable(column) {
  if (sortState.column === column) {
    sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.column = column;
    sortState.direction = 'asc';
  }

  const rows = Array.from(document.querySelectorAll('tbody tr'));
  rows.sort((a, b) => {
    const aVal = a.dataset[column];
    const bVal = b.dataset[column];
    const cmp = aVal < bVal ? -1 : 1;
    return sortState.direction === 'asc' ? cmp : -cmp;
  });

  rows.forEach(row => document.querySelector('tbody').appendChild(row));
}
```

Source: Pattern based on vanilla JS table sort (no DataTables dependency needed per spec).

### Pattern 3: Role-Based UI Visibility

**What:** Show different content based on user role (admin/manager/supervisor/support/agent).

**When to use:** Hiding per-agent tables for agents (they only see their own stats).

**Example (already in Phase 3 at line 381-389):**
```javascript
const user = authService.getCurrentUser();
if (user.role === 'support') {
  // Show company filter
  document.getElementById('companyFilterContainer').classList.remove('hidden');
} else if (user.role === 'agent') {
  // Hide per-agent table - agents don't see breakdown
  document.getElementById('agentBreakdownContainer').classList.add('hidden');
}
```

Source: Existing pattern from dashboard-stats.js.

### Anti-Patterns to Avoid

- **Avoid:** Inline SVG spinner code scattered everywhere. **Use:** Single spinner HTML component, show/hide it.
- **Avoid:** Direct DOM innerHTML updates with unsanitized data. **Use:** textContent for numbers, data attributes.
- **Avoid:** Global sort state. **Use:** Encapsulate in object or function closure.
- **Avoid:** Making API calls for per-agent data client-side (calling /api/stats/calls for each agent). **Use:** Single API endpoint returning all agents.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table sorting with 50+ rows | Custom sort function trying to parse dates | Use native `.sort()` with data attributes and date parsing | Easy to get wrong: timezone handling, locale comparisons, null values |
| CSV export | `JSONToCSV()` function | Built-in `Blob` + `URL.createObjectURL()` (Phase 6) | Escaping, line breaks, special chars need handling |
| Loading skeleton | CSS animation from scratch | Tailwind's `animate-pulse` or `animate-spin` | Already available, tested, performant |
| Date formatting | Manual string slicing | `Date.toLocaleDateString()` or Intl API | Handles locales, timezones, edge cases |

**Key insight:** Vanilla JS is sufficient for Phase 4. Resist urge to add libraries (jQuery, Lodash, libraries for simple tasks). The SSE infrastructure and auth services already use vanilla JS—stay consistent.

## Common Pitfalls

### Pitfall 1: Missing Per-Agent Data in API Response

**What goes wrong:** Frontend assumes `/api/stats/calls` returns per-agent breakdown, but current Phase 3 API returns only company/manager aggregates.

**Why it happens:** Phase 3 focused on aggregate stats. Per-agent breakdown (DISP-02 requirement) wasn't built into backend.

**How to avoid:**
- Verify Phase 4 tasks include building per-agent API endpoints
- Test API response structure before writing frontend rendering code
- Current response example from Phase 3: `{success: true, stats: {total_calls: 42, answered_calls: 35, ...}}`
- Phase 4 needs: `{success: true, stats: {total_calls: 42, agents: [{name: "John", calls: 15}, ...]}}`

**Warning signs:** Frontend tries to render table with undefined agent data, empty tbody.

### Pitfall 2: Infinite Loop on Filter Change + SSE Update

**What goes wrong:** User clicks time filter → fetchStats() called → API response triggers updateStatsDisplay() → SSE message arrives → updateStatsDisplay() called again → card re-renders → event fires again.

**Why it happens:** No debouncing on filter clicks; SSE updates can fire during user interaction.

**How to avoid:**
- Add flag to prevent concurrent fetches: `let isFetching = false;`
- Check before calling fetchStats: `if (isFetching) return;`
- Set flag before fetch, clear after response
- SSE messages should NOT trigger full re-render if user just changed filter (wait 1-2 seconds)

**Warning signs:** Console shows many repeated "Stats loaded" messages; CPU spikes during filter changes.

### Pitfall 3: Missing Loading State During Fetch

**What goes wrong:** User clicks filter button, UI doesn't change for 1+ seconds, user thinks button didn't work and clicks again.

**Why it happens:** Forgot to show loading spinner before fetch; old stats still displayed.

**How to avoid:**
- Show loading spinner BEFORE fetch: `statsLoading.classList.remove('hidden')`
- Hide cards: `statsCards.classList.add('hidden')`
- After fetch completes, reverse: hide spinner, show cards
- Current Phase 3 code doesn't have loading state (lines 236-238 placeholder comment)

**Warning signs:** User tests report stats "feel slow"; button clicks seem ignored.

### Pitfall 4: Browser Memory Leak with Event Listeners

**What goes wrong:** Every time `updateStatsDisplay()` called, new HTML with onclick handlers added to DOM. Old handlers never cleaned up. After 100 filter clicks, 100 invisible click listeners attached.

**Why it happens:** Using innerHTML to create sortable table headers with inline onclick; events accumulate.

**How to avoid:**
- Use event delegation: single listener on table element, check `event.target.dataset.column`
- Or: clear old listeners before creating new ones
- Pattern: `table.removeEventListener('click', sortHandler); /* render new HTML */ table.addEventListener('click', sortHandler);`

**Warning signs:** Browser DevTools shows high memory usage; page slows down after multiple filter changes.

### Pitfall 5: Accessibility - Missing ARIA Labels and Semantic HTML

**What goes wrong:** Cards have no labels describing what metric they show; loading spinner has no role; sorting arrow unclear.

**Why it happens:** Tailwind + vanilla JS focus on visual design, forget a11y.

**How to avoid:**
- Add `aria-label` to cards: `<div aria-label="Total Calls metric card">`
- Add `role="status"` to loading area
- Use `aria-sort="ascending"` on sortable headers
- Use semantic `<table>` not divs

**Warning signs:** Accessibility audit fails; screen reader users can't navigate page.

## Code Examples

Verified patterns from existing codebase:

### Example 1: Rendering Cards with Data

```javascript
// Source: dashboard-stats.js lines 255-294 (Phase 3)
// Phase 4 improvement: Add error handling, loading state

function updateStatsDisplay(taskStats, callStats, activityStats) {
  const content = document.getElementById('statsContent');

  // Extract values with defaults
  const stats = {
    totalCalls: callStats?.total_calls || 0,
    answeredCalls: callStats?.answered_calls || 0,
    totalTasks: taskStats?.total_tasks || 0,
    completedTasks: taskStats?.completed_tasks || 0,
    hoursOnline: activityStats?.hours_online || 0,
    activeCallHours: activityStats?.active_call_hours || 0
  };

  // Render cards
  content.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div class="bg-white p-4 rounded-lg shadow border border-gray-200">
        <h3 class="text-sm font-medium text-gray-500">Total Calls</h3>
        <p class="text-2xl font-bold text-gray-900 mt-2">${stats.totalCalls}</p>
      </div>
      <!-- More cards... -->
    </div>
  `;

  // Show cards, hide loading spinner
  document.getElementById('statsCards').classList.remove('hidden');
  document.getElementById('statsLoading').classList.add('hidden');
}
```

Source: Existing Phase 3 code pattern.

### Example 2: Handling Filter Changes with Loading State

```javascript
// Source: dashboard-stats.js lines 205-247 (Phase 3)
// Phase 4 addition: Add loading state management

async function fetchStats() {
  // Show loading spinner
  document.getElementById('statsLoading').classList.remove('hidden');
  document.getElementById('statsCards').classList.add('hidden');

  try {
    const params = new URLSearchParams();
    params.append('filter_type', currentFilter.type);

    if (currentFilter.type === 'custom') {
      params.append('start_date', currentFilter.startDate);
      params.append('end_date', currentFilter.endDate);
    }

    const user = authService.getCurrentUser();
    if (user.role === 'support' && currentCompanyId) {
      params.append('company_id', currentCompanyId);
    }

    // Fetch all 3 endpoints
    const [taskRes, callRes, activityRes] = await Promise.all([
      fetch(`${API_URL}/api/stats/tasks?${params}`, { credentials: 'include' }),
      fetch(`${API_URL}/api/stats/calls?${params}`, { credentials: 'include' }),
      fetch(`${API_URL}/api/stats/activity?${params}`, { credentials: 'include' })
    ]);

    const [taskData, callData, activityData] = await Promise.all([
      taskRes.json(),
      callRes.json(),
      activityRes.json()
    ]);

    if (taskData.success && callData.success && activityData.success) {
      updateStatsDisplay(taskData.stats, callData.stats, activityData.stats);
    } else {
      showError('Failed to load stats');
      document.getElementById('statsLoading').classList.add('hidden');
    }
  } catch (error) {
    console.error('Error fetching stats:', error);
    showError('Network error loading stats');
    document.getElementById('statsLoading').classList.add('hidden');
  }
}
```

Source: Existing Phase 3 pattern adapted with error handling.

### Example 3: Table with Event Delegation for Sorting

```javascript
// Source: Vanilla JS pattern for sortable tables
// Phase 4: Render per-agent breakdown table

let agentTableData = [];
let currentSort = { column: 'name', direction: 'asc' };

function renderAgentTable(agents) {
  agentTableData = agents;
  const tbody = document.querySelector('#agentTable tbody');
  tbody.innerHTML = agents
    .map(agent => `
      <tr class="border-b border-gray-200 hover:bg-gray-50">
        <td class="px-4 py-3 text-sm text-gray-900" data-name="${agent.name}">
          ${agent.name}
        </td>
        <td class="px-4 py-3 text-right text-sm font-medium text-gray-900" data-calls="${agent.total_calls}">
          ${agent.total_calls}
        </td>
        <td class="px-4 py-3 text-right text-sm text-gray-600" data-answered="${agent.answered_calls}">
          ${agent.answered_calls}
        </td>
      </tr>
    `)
    .join('');
}

function initTableSorting() {
  const table = document.getElementById('agentTable');
  if (!table) return;

  // Single event listener for all sortable headers
  table.addEventListener('click', (e) => {
    const header = e.target.closest('[data-sortable]');
    if (!header) return;

    const column = header.dataset.sortable;
    sortAgentTable(column);
  });
}

function sortAgentTable(column) {
  // Toggle direction if same column clicked
  if (currentSort.column === column) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.column = column;
    currentSort.direction = 'asc';
  }

  // Sort array
  const sorted = [...agentTableData].sort((a, b) => {
    const aVal = a[column];
    const bVal = b[column];

    // Handle numbers vs strings
    const isNumber = typeof aVal === 'number';
    const comparison = isNumber
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));

    return currentSort.direction === 'asc' ? comparison : -comparison;
  });

  // Re-render with sorted data
  renderAgentTable(sorted);
  updateSortIndicators();
}

function updateSortIndicators() {
  document.querySelectorAll('[data-sortable]').forEach(header => {
    const arrow = header.querySelector('.sort-arrow');
    if (!arrow) return;

    if (header.dataset.sortable === currentSort.column) {
      arrow.textContent = currentSort.direction === 'asc' ? ' ↑' : ' ↓';
    } else {
      arrow.textContent = ' ↕';
    }
  });
}
```

Source: Pattern based on vanilla JS best practices (event delegation, data attributes).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jQuery for DOM manipulation | Vanilla ES6+ with querySelector/classList | ES6 standard (2015), adopted in Phase 1+ | Smaller bundle, native browser API |
| CSS frameworks (Bootstrap) | Tailwind CSS with CDN | ~2020+ industry shift | Faster styling, smaller final CSS |
| Server-side page rendering | Vanilla JS client-side updates | Frontend modernization | Real-time capable, responsive |

**Deprecated/outdated:**
- jQuery: Not used; Phase 1+ codebase is jQuery-free
- CSS preprocessors (SASS): Tailwind handles this via CDN
- Page reloads for data updates: SSE + DOM updates now standard

## Open Questions

1. **Per-Agent Data Architecture**
   - What we know: Phase 3 APIs return aggregate stats; per-agent breakdown needed for DISP-02
   - What's unclear: Should we add `/api/stats/calls/agents` endpoint or compute from individual agent calls?
   - Recommendation: Add backend endpoint. It's more efficient and maintains separation of concerns. Client shouldn't aggregate complex stats.

2. **Real-Time Updates via SSE**
   - What we know: SSE connection established in Phase 1; handler at line 87-104 in dashboard-stats.js
   - What's unclear: How should stat cards update when SSE "stats" message arrives? Full re-render or increment?
   - Recommendation: For Phase 4, don't update on SSE messages yet. Defer real-time updates to Phase 5 (Chart Visualization). User interactions (filter clicks) are sufficient.

3. **Agent-Only Role Behavior**
   - What we know: Agent role should see only their own stats
   - What's unclear: Show empty per-agent table? Hide table completely? Show single-row "Your Stats"?
   - Recommendation: Hide per-agent table for agents. Show only summary cards with their personal metrics. Add role check at line where agentBreakdownContainer is rendered.

4. **Handling Very Large Agent Lists**
   - What we know: Per-agent table could have 100+ rows
   - What's unclear: Pagination? Lazy loading? Filter/search?
   - Recommendation: Phase 4 shows all agents (no pagination). If >50 agents, add search filter in Phase 5.

## Sources

### Primary (HIGH confidence)
- **Existing Phase 3 code** - `api/handlers/stats.go` (562 lines verified), `app/dashboard-stats.html` (256 lines verified), `app/dashboard-stats.js` (516 lines verified)
- **Phase 3 Verification** - `.planning/phases/03-core-metrics-time-filtering/03-VERIFICATION.md` confirms all endpoints working
- **Tailwind CSS CDN** - Live in `dashboard-stats.html` line 9, verified working in existing pages

### Secondary (MEDIUM confidence)
- **Browser APIs** - ES6, DOM, Fetch API verified in Phase 1-3 code
- **Vanilla JS patterns** - Event delegation, data attributes confirmed as project standard from existing code

### Tertiary (LOW confidence)
- None (no WebSearch-only findings; all verified against codebase)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Tailwind + vanilla JS already deployed, no libraries needed
- Architecture: HIGH - Patterns established in Phase 3; summary cards already exist
- Pitfalls: HIGH - Based on concrete issues that would occur if built wrong (SSE loops, memory leaks)
- Per-agent API gap: MEDIUM - Clear that new endpoints needed, but design choices deferred to planner

**Research date:** 2026-02-10
**Valid until:** 2026-02-24 (14 days - Tailwind CDN stable, no framework deps to track)

---

## Key Takeaway for Planner

**Phase 4 can proceed immediately.** All dependencies ready:
- ✓ Backend APIs functional with all time filters
- ✓ Frontend skeleton with time filter UI
- ✓ Tailwind CSS and vanilla JS patterns established
- ✓ SSE connection stable

**Single decision needed:** Design per-agent API endpoints. Once decided, frontend rendering is straightforward. No unusual technical challenges. Implement summary cards (refine existing rendering), add sortable table, handle loading states, add role-based visibility for agent role.
