import { authService } from './js/services/AuthService.js';

const registerForm = document.getElementById('registerForm');
const errorMessage = document.getElementById('errorMessage');
const submitBtn = document.getElementById('submitBtn');
const companySelect = document.getElementById('company_id');

// Load companies
async function loadCompanies() {
  try {
    const response = await fetch('/api/companies', {
      credentials: 'include'
    });
    const data = await response.json();

    if (data.success && data.companies) {
      data.companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company.id;
        option.textContent = company.name;
        companySelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Failed to load companies:', error);
  }
}

// Handle registration
async function handleRegister(e) {
  e.preventDefault();

  const firstname = document.getElementById('firstname').value.trim();
  const lastname = document.getElementById('lastname').value.trim();
  const email = document.getElementById('email').value.trim();
  const agent_id = document.getElementById('agent_id').value.trim();
  const company_id = parseInt(document.getElementById('company_id').value);
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Validate passwords match
  if (password !== confirmPassword) {
    showError('Passwords do not match');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';

  const result = await authService.register(email, password, firstname, lastname, agent_id, company_id);

  if (result.success) {
    window.location.href = '/app/dashboard-home.html';
  } else {
    showError(result.error || 'Registration failed');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Account';
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

registerForm.addEventListener('submit', handleRegister);
loadCompanies();
