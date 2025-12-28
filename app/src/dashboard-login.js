import { authService } from './js/services/AuthService.js';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const otpInput = document.getElementById('otp');
const passwordSection = document.getElementById('passwordSection');
const otpSection = document.getElementById('otpSection');
const toggleOtpBtn = document.getElementById('toggleOtpBtn');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const sendOtpBtn = document.getElementById('sendOtpBtn');
const submitBtn = document.getElementById('submitBtn');
const errorMessage = document.getElementById('errorMessage');
const otpTimer = document.getElementById('otpTimer');

// State
let isOtpMode = false;
let otpCountdown = null;

// Initialize
async function init() {
  // Check if already logged in
  await authService.init();
  if (authService.isAuthenticated()) {
    window.location.href = '/app/dashboard-home.html';
    return;
  }
}

// Toggle between password and OTP mode
function setPasswordMode() {
  isOtpMode = false;
  passwordSection.classList.remove('hidden');
  otpSection.classList.add('hidden');
  passwordInput.required = true;
  otpInput.required = false;
  hideError();
}

function setOtpMode() {
  isOtpMode = true;
  passwordSection.classList.add('hidden');
  otpSection.classList.remove('hidden');
  passwordInput.required = false;
  otpInput.required = true;
  hideError();
}

// OTP countdown timer
function startOtpCountdown(seconds) {
  let remaining = seconds;
  sendOtpBtn.disabled = true;
  sendOtpBtn.textContent = `Resend (${remaining}s)`;
  otpTimer.classList.remove('hidden');
  otpTimer.textContent = `Code expires in ${remaining} seconds`;

  otpCountdown = setInterval(() => {
    remaining--;
    sendOtpBtn.textContent = `Resend (${remaining}s)`;
    otpTimer.textContent = `Code expires in ${remaining} seconds`;

    if (remaining <= 0) {
      clearInterval(otpCountdown);
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = 'Send OTP';
      otpTimer.classList.add('hidden');
    }
  }, 1000);
}

// Send OTP
async function handleSendOtp() {
  const email = emailInput.value.trim();

  if (!email) {
    showError('Please enter your email address');
    emailInput.focus();
    return;
  }

  sendOtpBtn.disabled = true;
  sendOtpBtn.textContent = 'Sending...';

  const result = await authService.sendOTP(email);

  if (result.success) {
    showSuccess(result.message || 'OTP sent to your email');
    startOtpCountdown(60); // 60 second countdown
    otpInput.focus();
  } else {
    showError(result.error || 'Failed to send OTP');
    sendOtpBtn.disabled = false;
    sendOtpBtn.textContent = 'Send OTP';
  }
}

// Handle login form submission
async function handleLogin(e) {
  e.preventDefault();
  hideError();

  const email = emailInput.value.trim();

  if (!email) {
    showError('Please enter your email address');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';

  let result;

  if (isOtpMode) {
    // OTP Login
    const otp = otpInput.value.trim();

    if (!otp || otp.length !== 6) {
      showError('Please enter the 6-digit OTP code');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
      return;
    }

    result = await authService.verifyOTP(email, otp);
  } else {
    // Password Login
    const password = passwordInput.value;

    if (!password) {
      showError('Please enter your password');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
      return;
    }

    result = await authService.login(email, password);
  }

  if (result.success) {
    // Redirect to dashboard home
    window.location.href = '/app/dashboard-home.html';
  } else {
    showError(result.error || 'Invalid credentials');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
}

// Show error message
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

// Show success message
function showSuccess(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden', 'bg-red-50', 'border-red-200', 'text-red-700');
  errorMessage.classList.add('bg-green-50', 'border-green-200', 'text-green-700');
}

// Hide error message
function hideError() {
  errorMessage.classList.add('hidden');
  errorMessage.classList.add('bg-red-50', 'border-red-200', 'text-red-700');
  errorMessage.classList.remove('bg-green-50', 'border-green-200', 'text-green-700');
}

// Password visibility toggle
const togglePasswordVisibility = document.getElementById('togglePasswordVisibility');
const eyeIcon = document.getElementById('eyeIcon');

togglePasswordVisibility.addEventListener('click', () => {
  const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
  passwordInput.setAttribute('type', type);

  // Toggle eye icon (optional visual feedback)
  if (type === 'text') {
    eyeIcon.innerHTML = `
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
    `;
  } else {
    eyeIcon.innerHTML = `
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
    `;
  }
});

// Event listeners
togglePasswordBtn.addEventListener('click', setPasswordMode);
toggleOtpBtn.addEventListener('click', setOtpMode);
sendOtpBtn.addEventListener('click', handleSendOtp);
loginForm.addEventListener('submit', handleLogin);

// Auto-submit when 6 digits entered
otpInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
  if (e.target.value.length === 6) {
    // Optional: auto-submit
    // loginForm.dispatchEvent(new Event('submit'));
  }
});

// Initialize on load
init();
