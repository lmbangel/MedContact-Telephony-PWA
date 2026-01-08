import { authService } from './js/services/AuthService.js';
import { customerService } from './js/services/CustomerService.js';
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

  // Add Customer Modal handling
  const addCustomerBtn = document.getElementById('addCustomerBtn');
  const addCustomerModal = document.getElementById('addCustomerModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const addCustomerForm = document.getElementById('addCustomerForm');
  const formMessage = document.getElementById('formMessage');

  // Open modal
  if (addCustomerBtn) {
    addCustomerBtn.addEventListener('click', () => {
      addCustomerModal.classList.remove('hidden');
      addCustomerForm.reset();
      hideFormMessage();
    });
  }

  // Close modal handlers
  const closeModal = () => {
    addCustomerModal.classList.add('hidden');
    addCustomerForm.reset();
    hideFormMessage();
  };

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
  }

  // Close modal when clicking outside
  if (addCustomerModal) {
    addCustomerModal.addEventListener('click', (e) => {
      if (e.target === addCustomerModal) {
        closeModal();
      }
    });
  }

  // Form submission
  if (addCustomerForm) {
    addCustomerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Get form data
      const formData = new FormData(addCustomerForm);
      const user = authService.getCurrentUser();

      if (!user || !user.company_id) {
        showFormMessage('error', 'User not authenticated. Please log in again.');
        return;
      }

      // Prepare customer data
      const customerData = {
        company_id: user.company_id,
        first_name: formData.get('firstName'),
        last_name: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        medical_aid_provider: formData.get('medicalAidProvider') || '',
        medical_aid_number: formData.get('medicalAidNumber') || '',
        medical_plan: formData.get('medicalPlan') || '',
      };

      // Disable submit button
      const submitBtn = document.getElementById('submitBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Creating...
      `;

      try {
        // Call API to create customer
        const result = await customerService.createCustomer(customerData);

        if (result.success) {
          showFormMessage('success', 'Customer created successfully!');
          setTimeout(() => {
            closeModal();
          }, 1500);
        } else {
          showFormMessage('error', result.error || 'Failed to create customer');
        }
      } catch (error) {
        console.error('Error creating customer:', error);
        showFormMessage('error', 'An unexpected error occurred. Please try again.');
      } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Add Customer
        `;
      }
    });
  }
});

// Helper functions for form messages
function showFormMessage(type, message) {
  const formMessage = document.getElementById('formMessage');
  formMessage.classList.remove('hidden');

  if (type === 'success') {
    formMessage.className = 'mb-4 p-3 rounded-lg bg-green-50 text-green-800 border border-green-200';
  } else {
    formMessage.className = 'mb-4 p-3 rounded-lg bg-red-50 text-red-800 border border-red-200';
  }

  formMessage.textContent = message;
}

function hideFormMessage() {
  const formMessage = document.getElementById('formMessage');
  formMessage.classList.add('hidden');
}

init();
