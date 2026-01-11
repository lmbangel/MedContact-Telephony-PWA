import { authService } from './js/services/AuthService.js';
import { customerService } from './js/services/CustomerService.js';
import { taskService } from './js/services/TaskService.js';
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

// Fetch task statistics
async function fetchTaskStats(filters = {}) {
  try {
    const result = await taskService.getTaskStats(filters);

    if (result.success) {
      return result.stats;
    }
    return null;
  } catch (error) {
    console.error('Error fetching task stats:', error);
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

// Update dashboard with task stats
function updateTaskStats(stats) {
  if (!stats) return;
  console.log('Updating task stats:', stats);

  // Update pending tasks in the main card
  const pendingTasksElement = document.getElementById('pendingTasks');
  if (pendingTasksElement) {
    pendingTasksElement.textContent = stats.pendingTasks;
  }

  // Update outstanding tasks (in the metrics grid)
  const outstandingTasksElements = document.querySelectorAll('p.text-3xl.font-bold.text-orange-500');
  if (outstandingTasksElements.length > 0) {
    // Find the one under "Outstanding Tasks"
    outstandingTasksElements.forEach(el => {
      const parent = el.closest('.bg-gray-50');
      if (parent && parent.textContent.includes('Outstanding Tasks')) {
        el.textContent = stats.outstandingTasks;
      }
    });
  }

  // Update follow-ups (in the metrics grid)
  const followUpElements = document.querySelectorAll('p.text-3xl.font-bold.text-green-500');
  if (followUpElements.length > 0) {
    // Find the one under "Follow-ups"
    followUpElements.forEach(el => {
      const parent = el.closest('.bg-gray-50');
      if (parent && parent.textContent.includes('Follow-ups')) {
        el.textContent = stats.followUpTasks;
      }
    });
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

  // Fetch and display task statistics
  const taskStats = await fetchTaskStats();
  updateTaskStats(taskStats);

  // Refresh call stats every 30 seconds
  setInterval(async () => {
    const updatedStats = await fetchCallStats();
    updateCallStats(updatedStats);
  }, 30000);

  // Refresh task stats every 30 seconds
  setInterval(async () => {
    const updatedTaskStats = await fetchTaskStats();
    updateTaskStats(updatedTaskStats);
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

// Handle task filter changes
async function handleTaskFilterChange() {
  const taskTypeFilter = document.getElementById('taskTypeFilter');
  const taskTimeFilter = document.getElementById('taskTimeFilter');

  const filters = {};

  // Get selected filter values
  if (taskTypeFilter && taskTypeFilter.value !== 'all') {
    filters.type = taskTypeFilter.value;
  }

  if (taskTimeFilter && taskTimeFilter.value !== 'all') {
    filters.time = taskTimeFilter.value;
  }

  // Fetch filtered task stats
  const taskStats = await fetchTaskStats(filters);

  // Update only the pending tasks count
  if (taskStats) {
    const pendingTasksElement = document.getElementById('pendingTasks');
    if (pendingTasksElement) {
      pendingTasksElement.textContent = taskStats.pendingTasks;
    }
  }
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

  // Task filter dropdowns
  const taskTypeFilter = document.getElementById('taskTypeFilter');
  const taskTimeFilter = document.getElementById('taskTimeFilter');

  if (taskTypeFilter) {
    taskTypeFilter.addEventListener('change', handleTaskFilterChange);
  }

  if (taskTimeFilter) {
    taskTimeFilter.addEventListener('change', handleTaskFilterChange);
  }

  // Schedule Follow-up Modal handling
  const scheduleFollowUpBtn = document.getElementById('scheduleFollowUpBtn');
  const scheduleFollowUpModal = document.getElementById('scheduleFollowUpModal');
  const closeFollowUpModalBtn = document.getElementById('closeFollowUpModalBtn');
  const cancelFollowUpBtn = document.getElementById('cancelFollowUpBtn');
  const scheduleFollowUpForm = document.getElementById('scheduleFollowUpForm');
  const followUpFormMessage = document.getElementById('followUpFormMessage');

  // Open follow-up modal
  if (scheduleFollowUpBtn) {
    scheduleFollowUpBtn.addEventListener('click', async () => {
      scheduleFollowUpModal.classList.remove('hidden');
      scheduleFollowUpForm.reset();
      hideFollowUpFormMessage();

      // Load customers for the dropdown
      await loadCustomersForFollowUpModal();
    });
  }

  // Close follow-up modal handlers
  const closeFollowUpModal = () => {
    scheduleFollowUpModal.classList.add('hidden');
    scheduleFollowUpForm.reset();
    hideFollowUpFormMessage();
  };

  if (closeFollowUpModalBtn) {
    closeFollowUpModalBtn.addEventListener('click', closeFollowUpModal);
  }

  if (cancelFollowUpBtn) {
    cancelFollowUpBtn.addEventListener('click', closeFollowUpModal);
  }

  // Close follow-up modal when clicking outside
  if (scheduleFollowUpModal) {
    scheduleFollowUpModal.addEventListener('click', (e) => {
      if (e.target === scheduleFollowUpModal) {
        closeFollowUpModal();
      }
    });
  }

  // Follow-up form submission
  if (scheduleFollowUpForm) {
    scheduleFollowUpForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Get form data
      const formData = new FormData(scheduleFollowUpForm);
      const user = authService.getCurrentUser();

      if (!user || !user.id) {
        showFollowUpFormMessage('error', 'User not authenticated. Please log in again.');
        return;
      }

      // Prepare follow-up data (as a task with type='follow-up')
      const customerIdValue = formData.get('followUpCustomerId');

      if (!customerIdValue || customerIdValue === '') {
        showFollowUpFormMessage('error', 'Please select a customer.');
        return;
      }

      const followUpData = {
        assigned_to: user.id,
        title: formData.get('followUpTitle'),
        description: formData.get('followUpNotes') || '',
        type: 'follow-up', // Fixed type
        status: 'pending', // Default status
        due_date: formData.get('followUpDateTime') || null,
        customer_id: parseInt(customerIdValue),
        call_id: null,
      };

      // Disable submit button
      const submitFollowUpBtn = document.getElementById('submitFollowUpBtn');
      submitFollowUpBtn.disabled = true;
      submitFollowUpBtn.innerHTML = `
        <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Scheduling...
      `;

      try {
        // Call API to create follow-up (using the task service)
        const result = await taskService.createTask(followUpData);

        if (result.success) {
          showFollowUpFormMessage('success', 'Follow-up scheduled successfully!');

          // Refresh task stats
          const updatedTaskStats = await fetchTaskStats();
          updateTaskStats(updatedTaskStats);

          setTimeout(() => {
            closeFollowUpModal();
          }, 1500);
        } else {
          showFollowUpFormMessage('error', result.error || 'Failed to schedule follow-up');
        }
      } catch (error) {
        console.error('Error scheduling follow-up:', error);
        showFollowUpFormMessage('error', 'An unexpected error occurred. Please try again.');
      } finally {
        // Re-enable submit button
        submitFollowUpBtn.disabled = false;
        submitFollowUpBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          Schedule Follow-up
        `;
      }
    });
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

  // Create Task Modal handling
  const createTaskBtn = document.getElementById('createTaskBtn');
  const createTaskModal = document.getElementById('createTaskModal');
  const closeTaskModalBtn = document.getElementById('closeTaskModalBtn');
  const cancelTaskBtn = document.getElementById('cancelTaskBtn');
  const createTaskForm = document.getElementById('createTaskForm');
  const taskFormMessage = document.getElementById('taskFormMessage');

  // Open task modal
  if (createTaskBtn) {
    createTaskBtn.addEventListener('click', async () => {
      createTaskModal.classList.remove('hidden');
      createTaskForm.reset();
      hideTaskFormMessage();

      // Load customers for the dropdown
      await loadCustomersForTaskModal();
    });
  }

  // Close task modal handlers
  const closeTaskModal = () => {
    createTaskModal.classList.add('hidden');
    createTaskForm.reset();
    hideTaskFormMessage();
  };

  if (closeTaskModalBtn) {
    closeTaskModalBtn.addEventListener('click', closeTaskModal);
  }

  if (cancelTaskBtn) {
    cancelTaskBtn.addEventListener('click', closeTaskModal);
  }

  // Close task modal when clicking outside
  if (createTaskModal) {
    createTaskModal.addEventListener('click', (e) => {
      if (e.target === createTaskModal) {
        closeTaskModal();
      }
    });
  }

  // Task form submission
  if (createTaskForm) {
    createTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Get form data
      const formData = new FormData(createTaskForm);
      const user = authService.getCurrentUser();

      if (!user || !user.id) {
        showTaskFormMessage('error', 'User not authenticated. Please log in again.');
        return;
      }

      // Prepare task data
      const customerIdValue = formData.get('taskCustomerId');
      const callIdValue = formData.get('taskCallId');

      const taskData = {
        assigned_to: user.id, // Assign to current user
        title: formData.get('taskTitle'),
        description: formData.get('taskDescription') || '',
        type: formData.get('taskType') || 'task',
        status: formData.get('taskStatus') || 'pending',
        due_date: formData.get('taskDueDate') || null,
        customer_id: (customerIdValue && customerIdValue !== '') ? parseInt(customerIdValue) : null,
        call_id: (callIdValue && callIdValue !== '') ? parseInt(callIdValue) : null,
      };

      // Disable submit button
      const submitTaskBtn = document.getElementById('submitTaskBtn');
      submitTaskBtn.disabled = true;
      submitTaskBtn.innerHTML = `
        <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Creating...
      `;

      try {
        // Call API to create task
        const result = await taskService.createTask(taskData);

        if (result.success) {
          showTaskFormMessage('success', 'Task created successfully!');

          // Refresh task stats
          const updatedTaskStats = await fetchTaskStats();
          updateTaskStats(updatedTaskStats);

          setTimeout(() => {
            closeTaskModal();
          }, 1500);
        } else {
          showTaskFormMessage('error', result.error || 'Failed to create task');
        }
      } catch (error) {
        console.error('Error creating task:', error);
        showTaskFormMessage('error', 'An unexpected error occurred. Please try again.');
      } finally {
        // Re-enable submit button
        submitTaskBtn.disabled = false;
        submitTaskBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Create Task
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

// Helper functions for task form messages
function showTaskFormMessage(type, message) {
  const taskFormMessage = document.getElementById('taskFormMessage');
  taskFormMessage.classList.remove('hidden');

  if (type === 'success') {
    taskFormMessage.className = 'mb-4 p-3 rounded-lg bg-green-50 text-green-800 border border-green-200';
  } else {
    taskFormMessage.className = 'mb-4 p-3 rounded-lg bg-red-50 text-red-800 border border-red-200';
  }

  taskFormMessage.textContent = message;
}

function hideTaskFormMessage() {
  const taskFormMessage = document.getElementById('taskFormMessage');
  taskFormMessage.classList.add('hidden');
}

// Load customers for task modal dropdown
async function loadCustomersForTaskModal() {
  const customerSelect = document.getElementById('taskCustomerId');

  if (!customerSelect) return;

  // Show loading state
  customerSelect.innerHTML = '<option value="">Loading customers...</option>';
  customerSelect.disabled = true;

  try {
    const result = await customerService.getCustomersByCompany();
    console.log("Loaded customers for task modal:", result);

    if (result.success && result.customers) {
      // Reset dropdown
      customerSelect.innerHTML = '<option value="">-- No customer --</option>';

      // Populate with customers
      result.customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;

        // Format customer name
        let displayName = `${customer.first_name} ${customer.last_name}`;

        // Add phone if available
        if (customer.phone && customer.phone.Valid) {
          displayName += ` (${customer.phone.String})`;
        }

        option.textContent = displayName;
        customerSelect.appendChild(option);
      });

      customerSelect.disabled = false;
    } else {
      customerSelect.innerHTML = '<option value="">Failed to load customers</option>';
      console.error('Failed to load customers:', result.error);
    }
  } catch (error) {
    customerSelect.innerHTML = '<option value="">Error loading customers</option>';
    console.error('Error loading customers:', error);
  }
}

// Load customers for follow-up modal dropdown
async function loadCustomersForFollowUpModal() {
  const customerSelect = document.getElementById('followUpCustomerId');

  if (!customerSelect) return;

  // Show loading state
  customerSelect.innerHTML = '<option value="">Loading customers...</option>';
  customerSelect.disabled = true;

  try {
    const result = await customerService.getCustomersByCompany();
    console.log("Loaded customers for follow-up modal:", result);

    if (result.success && result.customers) {
      // Reset dropdown
      customerSelect.innerHTML = '<option value="">-- Select a customer --</option>';

      // Populate with customers
      result.customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;

        // Format customer name
        let displayName = `${customer.first_name} ${customer.last_name}`;

        // Add phone if available
        if (customer.phone && customer.phone.Valid) {
          displayName += ` (${customer.phone.String})`;
        }

        option.textContent = displayName;
        customerSelect.appendChild(option);
      });

      customerSelect.disabled = false;
    } else {
      customerSelect.innerHTML = '<option value="">Failed to load customers</option>';
      console.error('Failed to load customers:', result.error);
    }
  } catch (error) {
    customerSelect.innerHTML = '<option value="">Error loading customers</option>';
    console.error('Error loading customers:', error);
  }
}

// Helper functions for follow-up form messages
function showFollowUpFormMessage(type, message) {
  const followUpFormMessage = document.getElementById('followUpFormMessage');
  followUpFormMessage.classList.remove('hidden');

  if (type === 'success') {
    followUpFormMessage.className = 'mb-4 p-3 rounded-lg bg-green-50 text-green-800 border border-green-200';
  } else {
    followUpFormMessage.className = 'mb-4 p-3 rounded-lg bg-red-50 text-red-800 border border-red-200';
  }

  followUpFormMessage.textContent = message;
}

function hideFollowUpFormMessage() {
  const followUpFormMessage = document.getElementById('followUpFormMessage');
  followUpFormMessage.classList.add('hidden');
}

init();
