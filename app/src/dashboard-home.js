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

  // TODO: Fetch and display dashboard metrics
  // - Total calls today
  // - Active calls
  // - Customers contacted
  // - Pending tasks
  // etc.
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
});

init();
