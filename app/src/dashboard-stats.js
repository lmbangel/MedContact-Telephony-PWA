import { authService } from './js/services/AuthService.js';
import { sseService } from './js/services/SSEService.js';
import { API_URL } from './config.js';

// Last heartbeat timestamp
let lastHeartbeatTime = null;

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
 * Initialize stats page
 */
function initializeStatsPage() {
  console.log('Initializing stats page with SSE connection');

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
