# Phase 6: Export & Polish - Research

**Researched:** 2026-02-20
**Domain:** Client-side CSV export, offline connection detection, timezone display in vanilla JavaScript
**Confidence:** HIGH

## Summary

Phase 6 completes the stats dashboard with export capabilities and production-ready polish. Research identifies three independent features: (1) client-side CSV export using RFC 4180 escaping patterns, (2) offline connection indicator leveraging existing SSE service status, and (3) timezone display using native Intl.DateTimeFormat API.

**Key findings:**

1. **CSV export is a solved problem in vanilla JavaScript** - No libraries required. RFC 4180 standard specifies escaping: fields with commas/newlines/quotes are wrapped in quotes, and internal quotes are doubled. A 20-line utility function handles all edge cases. PapaParse exists but adds 40KB for what's already in the DOM.

2. **Offline indicator is already instrumented** - SSE service (Phase 1) already tracks connection status and broadcasts changes via onStatusChange callback. Offline indicator needs only UI binding to existing sseService.getStatus(). Three states: connected (green), connecting (yellow), disconnected (red) with optional reconnection attempts display.

3. **Timezone detection is native and reliable** - Intl.DateTimeFormat().resolvedOptions().timeZone retrieves user's system timezone as IANA string (e.g., "America/New_York"). All modern browsers support it (Chrome 24+, Safari 10+, Firefox 29+). Display as badge: "Times shown in America/New_York". No library needed.

4. **Client-side export eliminates server load** - All CSV generation happens in browser memory. Download via Blob + temporary anchor link pattern. Zero backend changes. Works offline (data already in DOM).

5. **Memory safety confirmed** - Chart data already bounded (Phase 5: 100-point windowing). Table data from API response (not accumulated). Export operation creates single Blob, triggers download, garbage collects. No persistent memory impact.

**Primary recommendation:** Implement CSV export with custom `escapeCSVField()` utility (15 lines), bind offline indicator to SSE service status callback, add timezone badge to page header. All three features are lightweight, zero-dependency additions to existing Phase 5 foundation. No refactoring needed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Blob API | Browser built-in (W3C standard) | In-memory file creation | All browsers, no dependencies, ~1KB minified |
| CSV escaping (custom) | N/A - utility function | RFC 4180 compliant field quoting | No library bloat (PapaParse adds 40KB); 15-line function handles all cases |
| Intl.DateTimeFormat | Browser built-in (ES5.1+) | Timezone name and display | All modern browsers (Chrome 24+, Safari 10+, Firefox 29+), system-aware, locale-sensitive |
| SSE Service | Existing (Phase 1) | Offline/online state tracking | Already integrated, broadcast mechanism ready via onStatusChange callback |
| navigator.onLine | Browser built-in (W3C standard) | Network availability hint | Supplementary to SSE status; CSS media query alternative for fallback |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | All features use native APIs | PapaParse (40KB) and Day.js (11KB) alternatives exist but add size; not justified here |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom CSV escaping | PapaParse library | PapaParse adds 40KB; RFC 4180 escaping is 15-line function. Justified only if multi-format export (JSON, XML) planned |
| Intl.DateTimeFormat | Day.js with timezone plugin | Day.js adds 11KB; Intl is built-in. Only use Day.js if complex date math needed beyond toLocaleDateString() |
| SSE status callback | navigator.onLine events | SSE status is more reliable for this app (connection verified by heartbeat). navigator.onLine unreliable (varies by OS). Use SSE as primary. |
| Blob + anchor link | canvas.toBlob() or fetch | Blob pattern is simplest for CSV. canvas.toBlob() for image export. fetch for server-side generation (not appropriate for this phase) |

**No installation needed.** All features use browser built-ins. No npm packages required.

## Architecture Patterns

### Recommended Project Structure
```
app/
├── dashboard-stats.html         # Add export button + timezone badge + offline indicator
└── src/
    ├── dashboard-stats.js       # Add event handlers for export
    └── js/utilities/
        ├── CsvExporter.js       # NEW: CSV generation with RFC 4180 escaping
        ├── OfflineIndicator.js  # NEW: Bind SSE status to UI
        └── TimezoneDetector.js  # NEW: Detect and display timezone
```

### Pattern 1: RFC 4180 CSV Field Escaping

**What:** Escape special characters (comma, newline, quote) according to RFC 4180 standard.

**When to use:** Any CSV generation from JavaScript arrays or DOM tables.

**Example:**
```javascript
// Source: RFC 4180 standard + vanilla JS implementation
// File: app/src/js/utilities/CsvExporter.js

/**
 * Escape a CSV field according to RFC 4180
 * Rules:
 *   - If field contains comma, newline, or double-quote: wrap in quotes
 *   - Double quotes inside field: escape by doubling (quote becomes two quotes)
 *   - Otherwise: use field as-is
 */
function escapeCSVField(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // Check if field requires quoting
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    // Escape internal quotes by doubling them, then wrap in quotes
    return '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

/**
 * Convert array of objects to CSV string
 * @param {Array<Object>} data - Array of objects with consistent keys
 * @param {Array<string>} headers - Column headers (optional; uses object keys if not provided)
 * @returns {string} - CSV formatted string with CRLF line endings
 */
function convertToCSV(data, headers = null) {
  if (!data || data.length === 0) {
    return '';
  }

  // Determine headers from first object if not provided
  const cols = headers || Object.keys(data[0]);

  // Build header row
  const headerRow = cols.map(escapeCSVField).join(',');

  // Build data rows
  const dataRows = data.map(row => {
    return cols.map(col => escapeCSVField(row[col])).join(',');
  });

  // Combine with CRLF line endings (RFC 4180 standard)
  // Add UTF-8 BOM (\ufeff) for Excel encoding detection
  return '\ufeff' + [headerRow, ...dataRows].join('\r\n');
}

/**
 * Download CSV data as file
 * @param {string} csvContent - CSV formatted string
 * @param {string} filename - Downloaded filename (e.g., "stats.csv")
 */
function downloadCSV(csvContent, filename = 'export.csv') {
  // Create Blob with UTF-8 text/csv MIME type
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create temporary URL
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  // Set download attributes and trigger click
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  // Append to DOM (required for some browsers), click, remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup object URL
  URL.revokeObjectURL(url);
}

// Usage in dashboard-stats.js:
const data = [
  { agent: 'Alice Smith', calls: 42, answered: 39 },
  { agent: 'Bob Johnson, Inc.', calls: 38, answered: 35 }, // Contains comma
  { agent: 'Carol\nWilliams', calls: 51, answered: 48 }    // Contains newline
];

const csv = convertToCSV(data);
downloadCSV(csv, `stats-${new Date().toISOString().split('T')[0]}.csv`);
```

**Source:** RFC 4180 specification https://www.rfc-editor.org/rfc/rfc4180.html + verified vanilla JS patterns from MDN and Stack Overflow.

### Pattern 2: Offline Indicator Binding to SSE Service

**What:** Display connection status (online/connecting/offline) leveraging existing SSE service status.

**When to use:** Any app with real-time SSE/WebSocket connections where user should see network state.

**Example:**
```javascript
// Source: Phase 1 SSEService + existing onStatusChange callback
// File: app/src/js/utilities/OfflineIndicator.js

class OfflineIndicator {
  constructor(sseService, containerId = 'sse-status-indicator') {
    this.sseService = sseService;
    this.indicator = document.getElementById(containerId);
    this.statusText = document.getElementById('sse-status-text');

    if (!this.indicator) {
      console.warn(`Offline indicator container not found: ${containerId}`);
      return;
    }

    // Hook into existing SSE service status changes
    this.sseService.setListeners({
      onStatusChange: (status, reconnectAttempts) => {
        this.updateUI(status, reconnectAttempts);
      }
    });

    // Initial state
    this.updateUI(this.sseService.getStatus());
  }

  /**
   * Update visual indicator based on SSE connection status
   * Three states:
   *   - 'connected': Green indicator, "Connected"
   *   - 'connecting': Yellow pulsing indicator, "Connecting..." or "Reconnecting (2/5)..."
   *   - 'disconnected': Red indicator, "Offline"
   */
  updateUI(status, reconnectAttempts = 0) {
    if (!this.indicator || !this.statusText) return;

    switch (status) {
      case 'connected':
        this.indicator.className = 'w-2 h-2 rounded-full bg-green-500';
        this.statusText.textContent = 'Connected';
        this.statusText.className = 'text-xs text-green-600';
        this.indicator.title = 'Real-time connection active';
        break;

      case 'connecting':
        this.indicator.className = 'w-2 h-2 rounded-full bg-yellow-500 animate-pulse';
        if (reconnectAttempts > 0) {
          this.statusText.textContent = `Reconnecting (${reconnectAttempts}/5)...`;
        } else {
          this.statusText.textContent = 'Connecting...';
        }
        this.statusText.className = 'text-xs text-yellow-600';
        this.indicator.title = 'Attempting to establish connection';
        break;

      case 'disconnected':
        this.indicator.className = 'w-2 h-2 rounded-full bg-red-500';
        this.statusText.textContent = 'Offline';
        this.statusText.className = 'text-xs text-red-600';
        this.indicator.title = 'Real-time connection lost';
        break;

      default:
        this.indicator.className = 'w-2 h-2 rounded-full bg-gray-400';
        this.statusText.textContent = 'Unknown';
        this.statusText.className = 'text-xs text-gray-600';
    }
  }
}

// Usage in dashboard-stats.js:
const offlineIndicator = new OfflineIndicator(sseService, 'sse-status-indicator');

// No additional binding needed - SSE service already calls onStatusChange callback
// Existing dashboard-stats.html element #sse-status-indicator already wired
```

**Source:** Phase 1 SSE Service architecture + Tailwind CSS state classes from Phase 4.

**Note:** Indicator already exists in dashboard-stats.html (lines 115-118). Phase 6 task is to extend OfflineIndicator class and bind it properly.

### Pattern 3: Timezone Detection and Display

**What:** Detect user's system timezone and display in UI as informational badge.

**When to use:** Any time-based dashboard where users in different timezones might be confused about which TZ stats display.

**Example:**
```javascript
// Source: Intl.DateTimeFormat API (MDN) + browser built-in
// File: app/src/js/utilities/TimezoneDetector.js

class TimezoneDetector {
  /**
   * Get user's system timezone as IANA string
   * Examples: "America/New_York", "Europe/London", "Asia/Tokyo"
   * @returns {string} - IANA timezone identifier
   */
  static getTimezone() {
    try {
      // Modern standard (Chrome 24+, Safari 10+, Firefox 29+, all modern browsers)
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return timezone;
    } catch (error) {
      console.warn('Could not detect timezone:', error);
      return 'UTC'; // Fallback
    }
  }

  /**
   * Format timezone for display
   * Removes underscores and simplifies: "America/Los_Angeles" → "Los Angeles"
   * @param {string} timezone - IANA timezone string
   * @returns {string} - User-friendly display name
   */
  static formatTimezoneDisplay(timezone) {
    // Extract region part after slash
    const [, region] = timezone.split('/');
    if (!region) return timezone;

    // Replace underscores with spaces
    return region.replace(/_/g, ' ');
  }

  /**
   * Display timezone in UI header
   * Adds badge: "Times shown in America/New_York"
   * @param {string} containerId - ID of element to insert timezone badge
   */
  static displayTimezoneInHeader(containerId = 'timezone-display') {
    const timezone = this.getTimezone();
    const displayName = this.formatTimezoneDisplay(timezone);

    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`Timezone display container not found: ${containerId}`);
      return;
    }

    // Create timezone badge (Tailwind: gray badge in header)
    container.innerHTML = `
      <div class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600" title="Timezone for all times displayed">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>${displayName}</span>
      </div>
    `;
  }
}

// Usage in dashboard-stats.js (on page load):
TimezoneDetector.displayTimezoneInHeader('timezone-display');

// Alternative: Just get timezone without UI
const tz = TimezoneDetector.getTimezone(); // "America/New_York"
```

**Source:** Intl.DateTimeFormat API https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat (MDN, official standard).

### Pattern 4: CSV Export Button Integration

**What:** Wire export button to CSV generation and download.

**When to use:** Stats page needs data export capability.

**Example:**
```javascript
// Source: Combine Patterns 1, 2, 3 into dashboard-stats.js
// File: app/src/dashboard-stats.js (extend existing code)

import { CsvExporter } from './js/utilities/CsvExporter.js';
import { TimezoneDetector } from './js/utilities/TimezoneDetector.js';

/**
 * Export current stats view as CSV
 * Includes: summary cards data, agent breakdown table, charts data
 * All data visible in UI is exported
 */
function exportStatsAsCSV() {
  try {
    // Gather all visible data
    const exportData = {
      timestamp: new Date().toISOString(),
      timezone: TimezoneDetector.getTimezone(),
      filter: currentFilter.type,
      data: []
    };

    // 1. Export agent breakdown table (most relevant for stats export)
    const agentTableBody = document.getElementById('agentTableBody');
    if (agentTableBody && agentTableBody.children.length > 0) {
      const agents = [];

      agentTableBody.querySelectorAll('tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
          agents.push({
            'Agent Name': cells[0]?.textContent?.trim() || '',
            'Total Calls': cells[1]?.textContent?.trim() || '0',
            'Answered Calls': cells[2]?.textContent?.trim() || '0',
            'Avg Duration (seconds)': cells[3]?.textContent?.trim() || '0',
            'Total Tasks': cells[4]?.textContent?.trim() || '0',
            'Completed Tasks': cells[5]?.textContent?.trim() || '0'
          });
        }
      });

      if (agents.length > 0) {
        const csv = CsvExporter.convertToCSV(agents);
        const filename = `stats-${currentFilter.type}-${new Date().toISOString().split('T')[0]}.csv`;
        CsvExporter.downloadCSV(csv, filename);

        // User feedback
        showNotification('Stats exported successfully', 'success');
        return;
      }
    }

    showNotification('No data available to export', 'warning');
  } catch (error) {
    console.error('Export failed:', error);
    showNotification('Export failed: ' + error.message, 'error');
  }
}

// Wire button click
const exportBtn = document.getElementById('export-stats-btn');
if (exportBtn) {
  exportBtn.addEventListener('click', exportStatsAsCSV);
}

// Initialize timezone display on page load
document.addEventListener('DOMContentLoaded', () => {
  TimezoneDetector.displayTimezoneInHeader('timezone-display');
});
```

**Source:** Phase 5 dashboard implementation + Pattern 1 CSV escaping.

### Anti-Patterns to Avoid

- **Avoid:** Exporting raw decimal numbers without formatting (CSV import treats "0.123456789" as text). **Use:** Format via toLocaleString() in CSV export.
- **Avoid:** Including animation-state HTML in CSV (user sees "●" spinner instead of "Connected"). **Use:** Extract text content only via .textContent.
- **Avoid:** Exporting unbounded chart data (100 points × 10 charts = 1000 values). **Use:** Export summary table, not raw chart arrays.
- **Avoid:** Creating Blob without MIME type (Excel imports as binary). **Use:** 'text/csv;charset=utf-8;' MIME type.
- **Avoid:** Not cleaning up object URLs (createObjectURL leaks memory if not revoked). **Use:** URL.revokeObjectURL() after download.
- **Avoid:** Hard-coding timezone display ("Times in UTC"). **Use:** Intl.DateTimeFormat to detect actual system TZ.
- **Avoid:** Assuming SSE connection = network connection. **Use:** SSE status is more reliable than navigator.onLine for this app.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV escaping (comma, newline, quote) | Manual string concatenation | RFC 4180 `escapeCSVField()` function (15 lines) | RFC 4180 defines proper escaping rules; manually building CSVs introduces bugs (common: backslash escaping doesn't work) |
| Timezone detection | IP geolocation or browser locale | Intl.DateTimeFormat().resolvedOptions().timeZone | Intl reads system clock, not user location; 100% accurate, no privacy concerns |
| Offline indicator | Custom network polling | SSE service onStatusChange callback | SSE status verified by heartbeat; navigator.onLine unreliable (varies by OS and browser) |
| Blob download | Fetch to server, then download | Blob + anchor link pattern | Client-side Blob eliminates round-trip, works offline, instant feedback |
| Date formatting in CSV | Manual date.toString() | date.toLocaleDateString() or Intl.DateTimeFormat | Handles locales, timezones, edge cases automatically |

**Key insight:** All three Phase 6 features (export, offline indicator, timezone display) are native browser capabilities. No dependencies, no libraries, just API calls.

## Common Pitfalls

### Pitfall 1: CSV Escaping Mistakes (Comma, Newline, Quote)

**What goes wrong:** Developer manually builds CSV string: `csv = name + ',' + value`. If name contains "Smith, Inc.", result is malformed: `Smith, Inc.,value` (parser thinks there are 3 fields, not 2).

**Why it happens:** CSV escaping rules (RFC 4180) are non-obvious. Many developers assume backslash works: `\"quote\"` — but RFC 4180 requires doubling: `""quote""`.

**How to avoid:**
- Use `escapeCSVField()` utility for every value: `csv = escapeCSVField(name) + ',' + escapeCSVField(value)`
- Test with sample data containing commas, newlines, quotes:
  ```javascript
  const test = [
    { name: 'Smith, Inc.', calls: 5 },        // Comma
    { name: 'Alice\nBob', calls: 3 },         // Newline
    { name: 'Quote"Unquote', calls: 2 }       // Quote
  ];
  const csv = convertToCSV(test);
  // Result should have fields properly quoted
  ```

**Warning signs:** CSV opens in Excel with misaligned columns. Online CSV validator shows "field count mismatch."

**Test:** Open exported CSV in Excel or Google Sheets. All fields should align correctly.

### Pitfall 2: Missing UTF-8 BOM for Excel Encoding

**What goes wrong:** User exports CSV with non-ASCII characters (e.g., agent name "François"). Opens in Excel, sees gibberish: "FranÃ§ois".

**Why it happens:** Excel uses ANSI by default. UTF-8 CSV needs BOM (\ufeff) for Excel to auto-detect encoding.

**How to avoid:**
- Add UTF-8 BOM to CSV string: `'\ufeff' + csvContent`
- Specify MIME type correctly: `new Blob([csv], { type: 'text/csv;charset=utf-8;' })`

**Warning signs:** Non-ASCII characters appear garbled in Excel.

**Test:** Create CSV with French/German/Japanese agent names. Open in Excel. Should display correctly.

### Pitfall 3: Exporting Chart Data Instead of Table

**What goes wrong:** Developer exports all chart data points (100 per chart) to CSV. User gets wall of numbers instead of summary. CSV is massive (10KB+) and hard to read.

**Why it happens:** Novice approach: "Just dump everything to CSV." Real users want summary table (agent names + stats), not trending timeseries.

**How to avoid:**
- Export agent breakdown table (primary data source for UI display)
- Include summary counts (total calls, tasks, etc.) as header metadata
- Leave chart raw data in browser; users can screenshot or print chart if needed

**Warning signs:** User says "CSV is useless, just shows numbers with no labels."

**Test:** Export stats. Open CSV. Should see agent names in first column, metrics in subsequent columns, readable without scrolling right.

### Pitfall 4: Offline Indicator Never Updates

**What goes wrong:** Indicator shows "Offline" even when connected. Or shows "Connected" after SSE drops. User is confused about real-time status.

**Why it happens:** Offline indicator set to display status once (on page load), but never listens to SSE status changes.

**How to avoid:**
- Create OfflineIndicator class that hooks sseService.onStatusChange callback
- Callback fires every time status changes (connect, reconnect, disconnect)
- UI updates automatically via callback, no manual refresh needed

**Warning signs:** Indicator static, doesn't change when network drops/reconnects. SSE debug panel shows status changing, but indicator doesn't.

**Test:** Open page (connected → green). Kill network (using DevTools > Network > Offline). Indicator should turn red within 10 seconds. Restore network. Indicator should turn green after SSE reconnects (30-60 seconds with exponential backoff).

### Pitfall 5: Timezone Detection in Different Timezones Shows UTC

**What goes wrong:** User in New York sees "Times shown in UTC". Actually sees local times (EDT) on page but badge is wrong. Confusion.

**Why it happens:** Fallback to UTC when Intl.DateTimeFormat().resolvedOptions().timeZone fails. Browser issue or old fallback code.

**How to avoid:**
- Verify Intl.DateTimeFormat support (all modern browsers 2015+)
- Test in multiple browser/OS combinations
- If fallback needed, use Date.getTimezoneOffset() as secondary detection (less accurate but always works)

**Warning signs:** Timezone badge always says "UTC" regardless of system timezone.

**Test:** Set system timezone to different values (America/Los_Angeles, Asia/Tokyo, Europe/London). Reload page. Badge should match system timezone.

### Pitfall 6: Memory Leak from Repeated Exports

**What goes wrong:** User exports 10 times in a session. Browser memory grows 50MB. Page gets sluggish.

**Why it happens:** Blob URLs created but not revoked. URL.revokeObjectURL() forgotten after download.

**How to avoid:**
- Always revoke object URL after download:
  ```javascript
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.click();
  URL.revokeObjectURL(url); // CRITICAL: cleanup
  ```
- Keep export operation self-contained; don't accumulate state

**Warning signs:** Memory usage grows 5-10MB per export. DevTools Detached DOM nodes count increases.

**Test:** Export 50 times in a row. Monitor DevTools Memory. Should return to baseline after each export.

### Pitfall 7: Table Data Extraction Gets HTML Instead of Text

**What goes wrong:** CSV cell contains "●Connected" (circle emoji + text) because code uses `innerHTML` instead of `textContent`. CSV viewer shows garbage.

**Why it happens:** Using `innerHTML` to grab table cells includes HTML tags and entities. `textContent` extracts plain text only.

**How to avoid:**
- Use `.textContent` for CSV export: `cells[0].textContent.trim()`
- Never use `.innerHTML` for data extraction

**Warning signs:** CSV cells contain HTML tags or emoji rendering issues.

**Test:** Export table where cells contain styled text (bold, icons). CSV should show plain text only, no formatting.

## Code Examples

Verified patterns from official sources:

### Example 1: RFC 4180 CSV Field Escaping

```javascript
// Source: https://www.rfc-editor.org/rfc/rfc4180.html
// File: app/src/js/utilities/CsvExporter.js

/**
 * Escape CSV field according to RFC 4180
 * If field contains comma, newline, or quote: wrap in quotes and escape internal quotes
 */
function escapeCSVField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Test cases
console.assert(escapeCSVField('Simple') === 'Simple');
console.assert(escapeCSVField('Smith, Inc.') === '"Smith, Inc."');
console.assert(escapeCSVField('Line1\nLine2') === '"Line1\nLine2"');
console.assert(escapeCSVField('Say "Hello"') === '"Say ""Hello"""');
```

**Source:** RFC 4180 https://www.rfc-editor.org/rfc/rfc4180.html

### Example 2: Intl.DateTimeFormat Timezone Detection

```javascript
// Source: MDN https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
// File: app/src/js/utilities/TimezoneDetector.js

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log(timezone); // Output: "America/New_York" (or user's system timezone)

// Format for display
const displayName = timezone.split('/')[1].replace(/_/g, ' ');
console.log(displayName); // Output: "New York"
```

**Source:** MDN Intl.DateTimeFormat https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat

### Example 3: Blob Download Pattern

```javascript
// Source: MDN Blob API + HTML5 Download pattern
// File: app/src/js/utilities/CsvExporter.js

function downloadCSV(csvContent, filename = 'export.csv') {
  // Create Blob with correct MIME type
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create temporary download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  // Configure and trigger download
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  // Append, click, remove (required for some browsers)
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup object URL
  URL.revokeObjectURL(url);
}
```

**Source:** MDN Blob API https://developer.mozilla.org/en-US/docs/Web/API/Blob + HTML5 download attribute standard.

### Example 4: SSE Status Binding for Offline Indicator

```javascript
// Source: Phase 1 SSEService + onStatusChange callback pattern
// File: app/src/dashboard-stats.js (extend existing SSE setup)

// SSEService already has onStatusChange callback
sseService.setListeners({
  onStatusChange: (status, reconnectAttempts) => {
    const indicator = document.getElementById('sse-status-indicator');
    const statusText = document.getElementById('sse-status-text');

    if (status === 'connected') {
      indicator.className = 'w-2 h-2 rounded-full bg-green-500';
      statusText.textContent = 'Connected';
      statusText.className = 'text-xs text-green-600';
    } else if (status === 'connecting') {
      indicator.className = 'w-2 h-2 rounded-full bg-yellow-500 animate-pulse';
      statusText.textContent = reconnectAttempts > 0 ? `Reconnecting (${reconnectAttempts}/5)...` : 'Connecting...';
      statusText.className = 'text-xs text-yellow-600';
    } else if (status === 'disconnected') {
      indicator.className = 'w-2 h-2 rounded-full bg-red-500';
      statusText.textContent = 'Offline';
      statusText.className = 'text-xs text-red-600';
    }
  }
});
```

**Source:** Phase 1 SSEService onStatusChange API + dashboard-stats.html existing indicator element.

### Example 5: Complete CSV Export Integration

```javascript
// Source: Combine all patterns - RFC 4180 + Blob + table extraction
// File: app/src/dashboard-stats.js

/**
 * Export agent breakdown table as CSV
 * Triggered by export button click
 */
function exportAgentStatsAsCSV() {
  try {
    // 1. Extract table data
    const agentTableBody = document.getElementById('agentTableBody');
    if (!agentTableBody || agentTableBody.children.length === 0) {
      alert('No agent data to export');
      return;
    }

    const agents = [];
    agentTableBody.querySelectorAll('tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 6) {
        agents.push({
          'Agent Name': cells[0].textContent.trim(),
          'Total Calls': parseInt(cells[1].textContent.trim()) || 0,
          'Answered': parseInt(cells[2].textContent.trim()) || 0,
          'Avg Duration (s)': parseFloat(cells[3].textContent.trim()) || 0,
          'Tasks': parseInt(cells[4].textContent.trim()) || 0,
          'Completed': parseInt(cells[5].textContent.trim()) || 0
        });
      }
    });

    if (agents.length === 0) {
      alert('No valid agent rows to export');
      return;
    }

    // 2. Build CSV with RFC 4180 escaping
    const headers = Object.keys(agents[0]);
    const headerRow = headers.map(h => escapeCSVField(h)).join(',');
    const dataRows = agents.map(agent =>
      headers.map(h => escapeCSVField(agent[h])).join(',')
    );
    const csv = '\ufeff' + [headerRow, ...dataRows].join('\r\n');

    // 3. Download
    const date = new Date().toISOString().split('T')[0];
    const filter = currentFilter.type || 'custom';
    downloadCSV(csv, `agent-stats-${filter}-${date}.csv`);

  } catch (error) {
    console.error('Export failed:', error);
    alert('Export failed: ' + error.message);
  }
}

// Wire export button
document.getElementById('export-btn')?.addEventListener('click', exportAgentStatsAsCSV);
```

**Source:** Phase 5 dashboard patterns + RFC 4180 escaping from Example 1.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side CSV generation (PHP, Python) | Client-side Blob + JavaScript | 2015+ (Blob API standard) | Zero server load, instant download, works offline |
| CSVExport jQuery plugin (deprecated) | Native Blob API + anchor link | 2020+ (libraries deprecated) | No dependencies, faster, smaller footprint |
| Hard-coded UTC timezone | Intl.DateTimeFormat detection | 2020+ (Intl support universal) | User-specific timezone, accurate DST handling |
| navigator.onLine for offline detection | SSE status + heartbeat verification | 2023+ (WebSockets/SSE matured) | More reliable, verified by server |
| PapaParse library for CSV escaping | RFC 4180 manual escaping (15 lines) | 2024+ (RFC 4180 well-known) | No library bloat, RFC compliant, maintainable |

**Deprecated/outdated:**
- CSVExport jQuery plugin (unmaintained)
- PapaParse for simple CSV (40KB library for 15-line utility)
- Server-side CSV generation (latency, server overhead)
- Date.getTimezoneOffset() for display (incomplete; doesn't account for DST region-specifically)

## Open Questions

1. **What data should be included in CSV export?**
   - What we know: "Current stats view" from requirements
   - What's unclear: Just agent table? Or also summary cards (total calls, etc.)?
   - Recommendation: Export agent breakdown table (primary data source). Include metadata header: export date, timezone, time filter. Chart data export deferred (users can screenshot if needed).

2. **Should offline indicator show while processing SSE reconnection?**
   - What we know: SSE service has `connecting` state with reconnect attempt count
   - What's unclear: Show pulsing yellow during reconnection, or only show red when failed?
   - Recommendation: Yellow pulsing + "Reconnecting (2/5)..." during attempts. Switch to red only after 5 attempts exhausted.

3. **Should timezone be auto-detected or user-selectable?**
   - What we know: Intl.DateTimeFormat detects system timezone
   - What's unclear: Allow user override (in case system clock is wrong)?
   - Recommendation: Auto-detect and display. Don't allow override (assumption: system clock is correct). If user needs different TZ, they can change system settings.

4. **Should CSV export warn if SSE is disconnected?**
   - What we know: Table data is from most recent API fetch (not real-time)
   - What's unclear: Should we prevent export if offline? Or just warn "data may be stale"?
   - Recommendation: Allow export always (data is already fetched and in DOM). Show info tooltip: "Data from last successful API fetch" when exporting while offline.

5. **Should exported CSV include chart trend data?**
   - What we know: Charts have bounded 100-point windowing (Phase 5)
   - What's unclear: Are those time-series useful in CSV, or just noise?
   - Recommendation: Don't export chart data to CSV. Export summary table only. Trend charts are visualization aid; raw data less useful without context.

## Sources

### Primary (HIGH confidence)
- **RFC 4180 Standard** - https://www.rfc-editor.org/rfc/rfc4180.html (official CSV format specification)
- **MDN Blob API** - https://developer.mozilla.org/en-US/docs/Web/API/Blob (W3C standard, all modern browsers)
- **MDN Intl.DateTimeFormat** - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat (ES5.1+ standard, Chrome 24+)
- **MDN Online/Offline Events** - https://developer.mozilla.org/en-US/docs/Web/API/Navigator/Online_and_offline_events (W3C standard)
- **Phase 1 SSEService Implementation** - /app/src/js/services/SSEService.js (project codebase, already validated)
- **Phase 5 Chart Research** - .planning/phases/05-chart-visualization/05-RESEARCH.md (memory safety, bounded data patterns)

### Secondary (MEDIUM confidence)
- **RFC 4180 Escaping Implementation** - Inventive https://inventivehq.com/blog/handling-special-characters-in-csv-files (verified with RFC standard)
- **CSV vs PapaParse Trade-offs** - StackShare https://stackshare.io/papaparse (community consensus on library overhead)
- **Timezone Detection Patterns** - LogRocket https://blog.logrocket.com/detect-location-local-time-zone-users-javascript/ (verified with Intl API docs)
- **Blob Download Pattern** - Code Maven https://code-maven.com/create-and-download-csv-with-javascript (verified with MDN Blob API)

### Tertiary (LOW confidence)
- None (all findings verified with official specs or project codebase)

## Metadata

**Confidence breakdown:**
- CSV escaping (RFC 4180): HIGH - Official standard, 15-year spec, numerous implementations
- Offline indicator: HIGH - Phase 1 SSE service already implements status tracking and callbacks
- Timezone detection (Intl): HIGH - W3C standard, universal browser support since 2015
- Blob download: HIGH - W3C standard, all browsers 2013+
- Pitfalls (special characters, UTF-8 BOM): HIGH - Documented in RFC 4180 and multiple verified sources

**Research date:** 2026-02-20
**Valid until:** 2026-03-06 (14 days - W3C standards stable, RFC 4180 timeless, browser APIs mature since 2015+)

---

## Key Takeaway for Planner

**Phase 6 is purely additive: three zero-dependency features** that leverage existing infrastructure (SSE service status tracking, chart data already in DOM, existing HTML button IDs).

**No refactoring needed.** All patterns are isolated utility functions:
1. `CsvExporter.js` - 40 lines of RFC 4180 escaping + Blob download
2. `OfflineIndicator.js` - 30 lines binding SSE status to UI (mostly replicating existing updateConnectionStatus logic)
3. `TimezoneDetector.js` - 20 lines detecting/displaying timezone via Intl API

**Critical success factors:**
1. RFC 4180 field escaping (double quotes, commas, newlines) — test with edge cases
2. UTF-8 BOM for Excel encoding — add '\ufeff' prefix
3. URL.revokeObjectURL() cleanup — prevent memory leaks
4. SSE status callback wiring — ensures offline indicator always in sync
5. Intl.DateTimeFormat fallback to UTC — handles old browser gracefully (unlikely but safe)

**Single architecture decision needed:** Create three utility files or inline in dashboard-stats.js? Recommendation: three separate files for reusability (if other pages need export or timezone display).

**No unusual technical challenges.** All features are straightforward DOM manipulation + native browser APIs. Standard patterns documented in MDN and verified by community implementation.
