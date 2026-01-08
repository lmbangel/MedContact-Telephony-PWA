import { authService } from './js/services/AuthService.js';
import { API_URL } from './config.js';

// Fetch company by ID
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

// Fetch agent status
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

// Fetch call statistics
async function fetchCallStats() {
  try {
    const response = await fetch(`${API_URL}/api/calls/stats`, {
      credentials: 'include'
    });
    const data = await response.json();

    if (data.success) {
      return {
        totalCalls: data.total_calls || 0,
        answeredCalls: data.answered_calls || 0,
        missedCalls: data.missed_calls || 0,
        avgDuration: data.avg_duration || 0
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching call stats:', error);
    return null;
  }
}

// Update dashboard with call stats
function updateCallStats(stats) {
  if (!stats) return;
  console.log('Updating call stats:', stats);

  // Update total calls today
  const totalCallsElement = document.getElementById('totalCallsToday');
  if (totalCallsElement) {
    totalCallsElement.textContent = stats.totalCalls;
  }

  // Update missed calls
  const missedCallsElement = document.getElementById('missedCallsToday');
  if (missedCallsElement) {
    missedCallsElement.textContent = stats.missedCalls;
  }

  // Update average duration (convert to minutes:seconds format)
  const avgDurationElement = document.getElementById('avgDurationToday');
  if (avgDurationElement) {
    const minutes = Math.floor(stats.avgDuration / 60);
    const seconds = Math.floor(stats.avgDuration % 60);
    const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    avgDurationElement.textContent = formattedDuration;
  }
}

// Update agent status
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
      console.log(`✅ Status updated to: ${status}`);
      return true;
    }
    console.error('Failed to update status');
    return false;
  } catch (error) {
    console.error('Error updating agent status:', error);
    return false;
  }
}

// Initialize
async function init() {
  // Check authentication
  await authService.init();

  if (!authService.isAuthenticated()) {
    window.location.href = '/app/dashboard-login.html';
    return;
  }

  // Display user info
  const user = authService.getCurrentUser();
  console.log('Logged in user:', user);

  const fullName = `${user.firstname} ${user.lastname}`;

  // Header - populate user info
  document.getElementById('headerUserName').textContent = fullName;

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

  // Fetch and display call statistics
  const callStats = await fetchCallStats();
  updateCallStats(callStats);

  // Refresh call stats every 30 seconds
  setInterval(async () => {
    const updatedStats = await fetchCallStats();
    updateCallStats(updatedStats);
  }, 30000);
}

// Logout handler
async function handleLogout() {
  await authService.logout();
  window.location.href = '/app/dashboard-login.html';
}

// Handle status change
async function handleStatusChange(event) {
  const newStatus = event.target.value;
  await updateAgentStatus(newStatus);
}

// Wait for DOM to load before attaching events
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  const statusDropdown = document.getElementById('agentStatus');
  if (statusDropdown) {
    statusDropdown.addEventListener('change', handleStatusChange);
  }

  // Phone panel toggle - only via telephony button
  const telephonyBtn = document.getElementById('telephony-btn');
  const phonePanel = document.getElementById('phone-panel');

  if (telephonyBtn && phonePanel) {
    telephonyBtn.addEventListener('click', () => {
      console.log('Toggling phone panel');
      phonePanel.classList.toggle('translate-x-0');
      phonePanel.classList.toggle('-translate-x-full');
    });
  }
});

init();
