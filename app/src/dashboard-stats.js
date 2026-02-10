import { authService } from './js/services/AuthService.js';
import { sseService } from './js/services/SSEService.js';
import { API_URL } from './config.js';

// Last heartbeat timestamp
let lastHeartbeatTime = null;

// Time filter state
let currentFilter = {
  type: 'today',
  startDate: null,
  endDate: null
};

// Prevent concurrent fetches
let isFetching = false;

/**
 * Fetch company by ID
 */
async function fetchCompany(companyId) {
  try {
    const response = await fetch(`${API_URL}/api/companies`, {
      credentials: 'include'
    });
    const data = await response.json();

    if (data.success && data.companies) {
      const company = data.companies.find(c => c.id === companyId);
      return company ? company.name : 'Unknown Company';
    }
    return 'Unknown Company';
  } catch (error) {
    console.error('Error fetching company:', error);
    return 'Unknown Company';
  }
}

/**
 * Fetch agent status
 */
async function fetchAgentStatus() {
  try {
    const response = await fetch(`${API_URL}/api/agent/status`, {
      credentials: 'include'
    });
    const data = await response.json();

    if (data.success) {
      return data.status;
    }
    return 'offline';
  } catch (error) {
    console.error('Error fetching agent status:', error);
    return 'offline';
  }
}

/**
 * Update agent status
 */
async function updateAgentStatus(status) {
  try {
    const response = await fetch(`${API_URL}/api/agent/status`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });

    const data = await response.json();

    if (data.success) {
      console.log(`Status updated to: ${status}`);
      return true;
    }
    console.error('Failed to update status');
    return false;
  } catch (error) {
    console.error('Error updating agent status:', error);
    return false;
  }
}

/**
 * Handle SSE message
 */
function handleSSEMessage(data) {
  console.log('SSE Message:', data);

  // Update debug panel
  const debugHeartbeat = document.getElementById('debug-heartbeat');
  if (debugHeartbeat) {
    lastHeartbeatTime = new Date();
    debugHeartbeat.textContent = lastHeartbeatTime.toLocaleTimeString();
  }

  // Handle different message types
  if (data.type === 'heartbeat') {
    console.log('Heartbeat received');
  } else if (data.type === 'stats') {
    console.log('Stats update received:', data);
    // Future: Update stats display here (Phase 4)
  }
}

/**
 * Update connection status UI
 */
function updateConnectionStatus(status, reconnectAttempts = 0) {
  const indicator = document.getElementById('sse-status-indicator');
  const statusText = document.getElementById('sse-status-text');
  const debugStatus = document.getElementById('debug-status');
  const debugAttempts = document.getElementById('debug-attempts');

  if (!indicator || !statusText) return;

  // Update debug panel
  if (debugStatus) {
    debugStatus.textContent = status;
  }
  if (debugAttempts) {
    debugAttempts.textContent = reconnectAttempts;
  }

  // Update visual indicator
  switch (status) {
    case 'connected':
      indicator.className = 'w-2 h-2 rounded-full bg-green-500';
      statusText.textContent = 'Connected';
      statusText.className = 'text-xs text-green-600';
      break;
    case 'connecting':
      indicator.className = 'w-2 h-2 rounded-full bg-yellow-500 animate-pulse';
      statusText.textContent = reconnectAttempts > 0
        ? `Reconnecting (${reconnectAttempts}/5)...`
        : 'Connecting...';
      statusText.className = 'text-xs text-yellow-600';
      break;
    case 'disconnected':
      indicator.className = 'w-2 h-2 rounded-full bg-red-500';
      statusText.textContent = reconnectAttempts >= 5
        ? 'Connection failed'
        : 'Disconnected';
      statusText.className = 'text-xs text-red-600';
      break;
    default:
      indicator.className = 'w-2 h-2 rounded-full bg-gray-400';
      statusText.textContent = 'Unknown';
      statusText.className = 'text-xs text-gray-600';
  }
}

/**
 * Handle SSE error
 */
function handleSSEError(error) {
  console.error('SSE Error:', error);
}

/**
 * Load companies for support role filter
 */
async function loadCompanies() {
  try {
    const response = await fetch(`${API_URL}/api/companies`, {
      credentials: 'include'
    });

    const data = await response.json();
    if (!data.success) {
      console.error('Failed to load companies');
      return;
    }

    const select = document.getElementById('companyFilter');
    data.companies.forEach(company => {
      const option = document.createElement('option');
      option.value = company.id;
      option.textContent = company.name;
      select.appendChild(option);
    });

    // Listen for company filter changes
    select.addEventListener('change', (e) => {
      const companyId = e.target.value;
      loadStatsForCompany(companyId);
    });
  } catch (error) {
    console.error('Error loading companies:', error);
  }
}

/**
 * Load stats for selected company
 */
async function loadStatsForCompany(companyId) {
  // Store company ID for use in fetchStats
  currentCompanyId = companyId;
  await fetchStats();
}

/**
 * Fetch stats with time filter parameters
 */
async function fetchStats() {
  if (isFetching) return;
  isFetching = true;

  // Show loading, hide cards and table
  document.getElementById('statsLoading')?.classList.remove('hidden');
  document.getElementById('statsCards')?.classList.add('hidden');
  document.getElementById('agentBreakdownContainer')?.classList.add('hidden');

  try {
    // Build query string with filter params
    const params = new URLSearchParams();
    params.append('filter_type', currentFilter.type);

    if (currentFilter.type === 'custom') {
      params.append('start_date', currentFilter.startDate);
      params.append('end_date', currentFilter.endDate);
    }

    // Add company_id for support role if needed
    const user = authService.getCurrentUser();
    if (user.role === 'support' && currentCompanyId) {
      params.append('company_id', currentCompanyId);
    }

    // Fetch all 4 endpoints in parallel
    const [taskRes, callRes, activityRes, agentsRes] = await Promise.all([
      fetch(`${API_URL}/api/stats/tasks?${params.toString()}`, { credentials: 'include' }),
      fetch(`${API_URL}/api/stats/calls?${params.toString()}`, { credentials: 'include' }),
      fetch(`${API_URL}/api/stats/activity?${params.toString()}`, { credentials: 'include' }),
      fetch(`${API_URL}/api/stats/agents?${params.toString()}`, { credentials: 'include' })
    ]);

    const [taskData, callData, activityData, agentsData] = await Promise.all([
      taskRes.json(),
      callRes.json(),
      activityRes.json(),
      agentsRes.json()
    ]);

    // Update UI with stats
    if (taskData.success && callData.success && activityData.success) {
      updateStatsDisplay(taskData.stats, callData.stats, activityData.stats);

      // Hide loading, show cards
      document.getElementById('statsLoading')?.classList.add('hidden');
      document.getElementById('statsCards')?.classList.remove('hidden');

      // Render agent table if data available and user not agent role
      if (agentsData.success && agentsData.agents && agentsData.agents.length > 0) {
        renderAgentTable(agentsData.agents);
        document.getElementById('agentBreakdownContainer')?.classList.remove('hidden');
      }
    } else {
      showError('Failed to load stats');
      document.getElementById('statsLoading')?.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    showError('Network error loading stats');
    document.getElementById('statsLoading')?.classList.add('hidden');
  } finally {
    isFetching = false;
  }
}

// Store current company ID for support role filtering
let currentCompanyId = null;

/**
 * Update stats display
 */
function updateStatsDisplay(taskStats, callStats, activityStats) {
  const content = document.getElementById('statsContent');

  // Handle different stat structures based on role
  const totalCalls = callStats.total_calls || 0;
  const totalTasks = taskStats.total_tasks || 0;
  const answeredCalls = callStats.answered_calls || 0;
  const completedTasks = taskStats.completed_tasks || 0;
  const hoursOnline = activityStats?.hours_online || 0;
  const activeCallHours = activityStats?.active_call_hours || 0;

  content.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div class="bg-white p-4 rounded-lg shadow border border-gray-200" aria-label="Total Calls metric card">
        <h3 class="text-sm font-medium text-gray-500">Total Calls</h3>
        <p class="text-2xl font-bold text-gray-900 mt-2">${totalCalls}</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow border border-gray-200" aria-label="Answered Calls metric card">
        <h3 class="text-sm font-medium text-gray-500">Answered Calls</h3>
        <p class="text-2xl font-bold text-green-600 mt-2">${answeredCalls}</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow border border-gray-200" aria-label="Total Tasks metric card">
        <h3 class="text-sm font-medium text-gray-500">Total Tasks</h3>
        <p class="text-2xl font-bold text-gray-900 mt-2">${totalTasks}</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow border border-gray-200" aria-label="Completed Tasks metric card">
        <h3 class="text-sm font-medium text-gray-500">Completed Tasks</h3>
        <p class="text-2xl font-bold text-blue-600 mt-2">${completedTasks}</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow border border-gray-200" aria-label="Hours Online metric card">
        <h3 class="text-sm font-medium text-gray-500">Hours Online</h3>
        <p class="text-2xl font-bold text-purple-600 mt-2">${Number(hoursOnline).toFixed(1)}</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow border border-gray-200" aria-label="Active Call Time metric card">
        <h3 class="text-sm font-medium text-gray-500">Active Call Time</h3>
        <p class="text-2xl font-bold text-orange-600 mt-2">${Number(activeCallHours).toFixed(1)} hrs</p>
      </div>
    </div>
  `;
}

/**
 * Agent table data and sort state
 */
let agentTableData = [];
let currentSort = { column: 'total_calls', direction: 'desc' };

/**
 * Render agent breakdown table
 */
function renderAgentTable(agents) {
  agentTableData = agents;
  const tbody = document.getElementById('agentTableBody');
  if (!tbody) return;

  tbody.innerHTML = agents
    .map(agent => {
      // Build agent name from firstname and lastname
      const agentName = `${agent.firstname} ${agent.lastname}`;
      return `
      <tr class="border-b border-gray-200 hover:bg-gray-50 transition">
        <td class="px-4 py-3 text-sm text-gray-900">${agentName}</td>
        <td class="px-4 py-3 text-right text-sm font-medium text-gray-900">${agent.total_calls}</td>
        <td class="px-4 py-3 text-right text-sm text-green-600">${agent.answered_calls}</td>
        <td class="px-4 py-3 text-right text-sm text-gray-600">${formatDuration(agent.avg_duration)}</td>
        <td class="px-4 py-3 text-right text-sm font-medium text-gray-900">${agent.total_tasks}</td>
        <td class="px-4 py-3 text-right text-sm text-blue-600">${agent.completed_tasks}</td>
      </tr>
    `;
    })
    .join('');

  updateSortIndicators();
}

/**
 * Format duration from seconds to MM:SS
 */
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Initialize table sorting event listeners
 */
function initTableSorting() {
  const table = document.getElementById('agentBreakdownTable');
  if (!table) return;

  // Event delegation for sortable headers
  table.addEventListener('click', (e) => {
    const header = e.target.closest('[data-sortable]');
    if (!header) return;

    const column = header.dataset.sortable;
    sortAgentTable(column);
  });
}

/**
 * Sort agent table by column
 */
function sortAgentTable(column) {
  // Toggle direction if same column
  if (currentSort.column === column) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.column = column;
    currentSort.direction = 'asc';
  }

  // Sort array
  const sorted = [...agentTableData].sort((a, b) => {
    let aVal, bVal;

    // Handle agent_name specially (built from firstname + lastname)
    if (column === 'agent_name') {
      aVal = `${a.firstname} ${a.lastname}`;
      bVal = `${b.firstname} ${b.lastname}`;
    } else {
      aVal = a[column];
      bVal = b[column];
    }

    // Handle numbers vs strings
    const isNumber = typeof aVal === 'number';
    const comparison = isNumber
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));

    return currentSort.direction === 'asc' ? comparison : -comparison;
  });

  // Re-render with sorted data
  renderAgentTable(sorted);
}

/**
 * Update sort direction indicators
 */
function updateSortIndicators() {
  document.querySelectorAll('[data-sortable]').forEach(header => {
    const arrow = header.querySelector('.sort-arrow');
    if (!arrow) return;

    if (header.dataset.sortable === currentSort.column) {
      arrow.textContent = currentSort.direction === 'asc' ? ' ↑' : ' ↓';
      header.setAttribute('aria-sort', currentSort.direction === 'asc' ? 'ascending' : 'descending');
    } else {
      arrow.textContent = ' ↕';
      header.removeAttribute('aria-sort');
    }
  });
}

/**
 * Show error message
 */
function showError(message) {
  console.error(message);
  const content = document.getElementById('statsContent');
  if (content) {
    content.innerHTML = `<div class="text-red-600 p-4">${message}</div>`;
  }
}

/**
 * Helper to update active button styling
 */
function setActiveFilter(filterType, startDate = null, endDate = null) {
  currentFilter = { type: filterType, startDate, endDate };

  // Update button styles
  const buttons = ['filter-today', 'filter-yesterday', 'filter-this-week', 'filter-this-month'];
  buttons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      if (btnId === `filter-${filterType.replace('_', '-')}`) {
        // Active state
        btn.classList.remove('border-gray-300', 'bg-white', 'text-gray-700');
        btn.classList.add('border-blue-600', 'bg-blue-600', 'text-white');
      } else {
        // Inactive state
        btn.classList.remove('border-blue-600', 'bg-blue-600', 'text-white');
        btn.classList.add('border-gray-300', 'bg-white', 'text-gray-700');
      }
    }
  });
}

/**
 * Setup time filter event listeners
 */
function setupTimeFilterListeners() {
  // Quick filter button handlers
  document.getElementById('filter-today')?.addEventListener('click', () => {
    setActiveFilter('today');
    fetchStats();
  });

  document.getElementById('filter-yesterday')?.addEventListener('click', () => {
    setActiveFilter('yesterday');
    fetchStats();
  });

  document.getElementById('filter-this-week')?.addEventListener('click', () => {
    setActiveFilter('this_week');
    fetchStats();
  });

  document.getElementById('filter-this-month')?.addEventListener('click', () => {
    setActiveFilter('this_month');
    fetchStats();
  });

  // Custom date range handler
  document.getElementById('filter-custom')?.addEventListener('click', () => {
    const startDate = document.getElementById('start-date')?.value;
    const endDate = document.getElementById('end-date')?.value;
    const errorEl = document.getElementById('date-error');

    // Validation
    if (!startDate || !endDate) {
      errorEl.textContent = 'Please select both start and end dates';
      errorEl.classList.remove('hidden');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      errorEl.textContent = 'Start date must be before or equal to end date';
      errorEl.classList.remove('hidden');
      return;
    }

    // Valid range
    errorEl.classList.add('hidden');
    setActiveFilter('custom', startDate, endDate);
    fetchStats();
  });
}

/**
 * Initialize stats page
 */
async function initializeStatsPage() {
  console.log('Initializing stats page with SSE connection');

  // Setup time filter listeners
  setupTimeFilterListeners();

  // Check user role and show company filter for support
  const user = authService.getCurrentUser();
  if (user.role === 'support') {
    // Show company filter for support role
    const filterContainer = document.getElementById('companyFilterContainer');
    filterContainer.classList.remove('hidden');

    // Populate company dropdown
    await loadCompanies();
  } else {
    // For other roles, load stats immediately
    await fetchStats();
  }

  // Setup SSE listeners
  sseService.setListeners({
    onMessage: handleSSEMessage,
    onStatusChange: updateConnectionStatus,
    onError: handleSSEError
  });

  // Connect to SSE stream
  sseService.connect(`${API_URL}/api/stats/stream`);

  // Cleanup on page unload - CRITICAL to prevent memory leaks
  window.addEventListener('beforeunload', cleanup);
}

/**
 * Cleanup function - CRITICAL for preventing SSE connection leaks
 */
function cleanup() {
  console.log('Page unloading - cleaning up SSE connection');
  sseService.disconnect();
}

/**
 * Logout handler
 */
async function handleLogout() {
  // Disconnect SSE before logout
  cleanup();
  await authService.logout();
  window.location.href = '/app/login.html';
}

/**
 * Handle status change
 */
async function handleStatusChange(event) {
  const newStatus = event.target.value;
  await updateAgentStatus(newStatus);
}

/**
 * Initialize authentication and page
 */
async function init() {
  // Check authentication
  await authService.init();

  if (!authService.isAuthenticated()) {
    window.location.href = '/app/login.html';
    return;
  }

  // Check role authorization
  const user = authService.getCurrentUser();
  const allowedRoles = ['admin', 'manager', 'supervisor', 'support'];
  if (!allowedRoles.includes(user.role)) {
    console.log('Unauthorized role for stats page:', user.role);
    window.location.href = '/app/dashboard-home.html';
    return;
  }

  // Display user info
  console.log('Logged in user:', user);

  const fullName = `${user.firstname} ${user.lastname}`;

  // Header - populate user info
  const headerUserName = document.getElementById('headerUserName');
  if (headerUserName) {
    headerUserName.textContent = fullName;
  }

  // Fetch and display company name
  const companyName = await fetchCompany(user.company_id);
  const companyElement = document.getElementById('headerCompanyName');
  if (companyElement) {
    companyElement.textContent = companyName;
  }

  // Update user avatar
  const avatarElement = document.getElementById('userAvatar');
  if (avatarElement) {
    avatarElement.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=e5e7eb&color=374151`;
  }

  // Fetch and set agent status
  const currentStatus = await fetchAgentStatus();
  const statusDropdown = document.getElementById('agentStatus');
  if (statusDropdown) {
    statusDropdown.value = currentStatus;
  }

  // Initialize stats page with SSE
  initializeStatsPage();
}

/**
 * Setup event listeners
 */
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  const statusDropdown = document.getElementById('agentStatus');
  if (statusDropdown) {
    statusDropdown.addEventListener('change', handleStatusChange);
  }

  // Initialize table sorting
  initTableSorting();

  // Navigation handlers
  const dashboardIcon = document.getElementById('side-dashboard-icon');
  if (dashboardIcon) {
    dashboardIcon.addEventListener('click', () => {
      cleanup(); // Clean up before navigation
      window.location.href = '/app/dashboard-home.html';
    });
  }
});

// Start initialization
init();
