/**
 * Login page logic
 */

import './styles/main.css';
import { authService } from './js/services/AuthService.js';

// Initialize auth service
authService.init().then(() => {
  // If already authenticated, redirect to phone app
  if (authService.isAuthenticated()) {
    window.location.href = '/app/phone.html';
  }
});

// Get form elements
const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const loginBtn = document.getElementById('login-btn');

// Handle form submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(loginForm);
  const email = formData.get('email');
  const password = formData.get('password');

  // Disable button and show loading
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';
  errorMessage.classList.add('hidden');

  try {
    const result = await authService.login(email, password);

    if (result.success) {
      // Redirect to phone app
      window.location.href = '/app/phone.html';
    } else {
      // Show error
      errorMessage.textContent = result.error || 'Failed to login';
      errorMessage.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Login error:', error);
    errorMessage.textContent = 'An unexpected error occurred';
    errorMessage.classList.remove('hidden');
  } finally {
    // Re-enable button
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
});
