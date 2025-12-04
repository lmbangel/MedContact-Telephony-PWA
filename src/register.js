/**
 * Register page logic
 */

import { authService } from './js/services/AuthService.js';

const API_URL = '/api';

// Initialize auth service
authService.init().then(() => {
  // If already authenticated, redirect to main app
  if (authService.isAuthenticated()) {
    window.location.href = '/';
  }
});

// Get form elements
const registerForm = document.getElementById('register-form');
const errorMessage = document.getElementById('error-message');
const registerBtn = document.getElementById('register-btn');
const companySelect = document.getElementById('company_id');

// Load companies
async function loadCompanies() {
  try {
    console.log('Loading companies from:', `${API_URL}/companies`);

    // Disable the select while loading
    companySelect.disabled = true;

    const response = await fetch(`${API_URL}/companies`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Companies response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('Companies data:', data);
      const companies = data.companies;

      if (companies && companies.length > 0) {
        // Clear all options
        companySelect.innerHTML = '';

        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a company';
        defaultOption.className = 'bg-gray-800';
        companySelect.appendChild(defaultOption);

        // Populate select with companies
        companies.forEach((company) => {
          const option = document.createElement('option');
          option.value = company.id.toString();
          option.textContent = company.name;
          option.className = 'bg-gray-800 text-white';
          companySelect.appendChild(option);
        });

        console.log(`✅ Loaded ${companies.length} companies`);
      } else {
        console.warn('No companies found');
        companySelect.innerHTML = '<option value="" class="bg-gray-800">No companies available</option>';
      }

      // Enable the select
      companySelect.disabled = false;
    } else {
      console.error('Failed to load companies, status:', response.status);
      const errorText = await response.text();
      console.error('Error response:', errorText);

      // Show error to user
      const firstOption = companySelect.options[0];
      firstOption.textContent = 'Error loading companies';
    }
  } catch (error) {
    console.error('Error loading companies:', error);

    // Show error to user
    const firstOption = companySelect.options[0];
    firstOption.textContent = 'Error loading companies';
    companySelect.disabled = true;
  }
}

// Load companies on page load
console.log('Register page loaded, loading companies...');
loadCompanies();

// Handle form submission
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(registerForm);
  const firstname = formData.get('firstname');
  const lastname = formData.get('lastname');
  const email = formData.get('email');
  const agent_id = formData.get('agent_id');
  const company_id = parseInt(formData.get('company_id'));
  const password = formData.get('password');
  const confirm_password = formData.get('confirm_password');

  // Validate passwords match
  if (password !== confirm_password) {
    errorMessage.textContent = 'Passwords do not match';
    errorMessage.classList.remove('hidden');
    return;
  }

  // Disable button and show loading
  registerBtn.disabled = true;
  registerBtn.textContent = 'Creating account...';
  errorMessage.classList.add('hidden');

  try {
    const result = await authService.register(
      email,
      password,
      firstname,
      lastname,
      agent_id,
      company_id
    );

    if (result.success) {
      // Redirect to main app
      window.location.href = '/';
    } else {
      // Show error
      errorMessage.textContent = result.error || 'Failed to register';
      errorMessage.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Registration error:', error);
    errorMessage.textContent = 'An unexpected error occurred';
    errorMessage.classList.remove('hidden');
  } finally {
    // Re-enable button
    registerBtn.disabled = false;
    registerBtn.textContent = 'Create Account';
  }
});
