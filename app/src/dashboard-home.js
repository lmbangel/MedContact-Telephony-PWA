import { authService } from './js/services/AuthService.js';

// Fetch company by ID
async function fetchCompany(companyId) {
  try {
    const response = await fetch(`/api/companies`, {
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

// Wait for DOM to load before attaching events
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
});

init();
