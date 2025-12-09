/**
 * Main application entry point
 * Initializes the softphone UI and event handlers
 */

import { callStore } from './js/services/CallStore.js';
import { ScreenController } from './js/ui/ScreenController.js';
import { authService } from './js/services/AuthService.js';
import { twilioService } from './js/services/TwilioService.js';
import { customerService } from './js/services/CustomerService.js';

// Check authentication before initializing
authService.init().then(() => {
  if (!authService.isAuthenticated()) {
    window.location.href = '/login.html';
    return;
  }

  // Continue with app initialization
  initializeApp();
});

// Initialize screen controller
const screenController = new ScreenController();

// Track active action buttons
const activeActions = new Set();
let speakerActive = false;
let currentNumber = '';

/**
 * Format phone number for display (South African format)
 * Converts: 0672966361 -> +27 67 296 6361
 */
function formatPhoneNumberDisplay(number) {
  // Remove all non-digits
  let digits = number.replace(/\D/g, '');

  // If starts with 0, replace with +27
  if (digits.startsWith('0')) {
    digits = '27' + digits.substring(1);
  }

  // If starts with 27, add +
  if (digits.startsWith('27') && !number.startsWith('+')) {
    digits = digits;
  }

  // Format as +27 67 296 6361
  if (digits.startsWith('27') && digits.length === 11) {
    return `+${digits.substring(0, 2)} ${digits.substring(2, 4)} ${digits.substring(4, 7)} ${digits.substring(7)}`;
  }

  // If already has +27, format it
  if (number.startsWith('+27')) {
    digits = number.replace(/\D/g, '');
    if (digits.length === 11) {
      return `+${digits.substring(0, 2)} ${digits.substring(2, 4)} ${digits.substring(4, 7)} ${digits.substring(7)}`;
    }
  }

  // Return as-is if doesn't match expected pattern
  return number;
}

/**
 * Normalize phone number for API calls
 * Converts: 0672966361 -> +27672966361 or +27 67 296 6361 -> +27672966361
 */
function normalizePhoneNumber(number) {
  // Remove all non-digits except +
  let normalized = number.replace(/[^\d+]/g, '');

  // If starts with 0, replace with +27
  if (normalized.startsWith('0')) {
    normalized = '+27' + normalized.substring(1);
  }

  // If starts with 27 but no +, add it
  if (normalized.startsWith('27') && !normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }

  return normalized;
}

/**
 * Initialize the application
 */
function initializeApp() {
  setupEventListeners();
  subscribeToStore();
  displayUserInfo();
  console.log('OmniCall initialized');

  // Auto-connect to Twilio on app load
  setTimeout(() => {
    handleInitTwilio();
  }, 500);
}

/**
 * Display user information
 */
function displayUserInfo() {
  const user = authService.getCurrentUser();
  if (user) {
    console.log(`Logged in as: ${user.firstname} ${user.lastname} (${user.email})`);

    // Update profile modal with user info
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profileCompany = document.getElementById('profile-company');

    if (profileName) {
      profileName.textContent = `${user.firstname} ${user.lastname}`;
    }
    if (profileEmail) {
      profileEmail.textContent = user.email;
    }
    if (profileCompany) {
      // You can fetch company name based on user.company_id if needed
      profileCompany.textContent = `Agent ID: ${user.agent_id}`;
    }
  }
}

/**
 * Subscribe to call store state changes
 */
function subscribeToStore() {
  callStore.subscribe((state) => {
    console.log('State changed:', state);
    screenController.updateScreen(state);
  });
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Show dialpad button
  const showDialpadBtn = document.getElementById('show-dialpad-btn');
  showDialpadBtn?.addEventListener('click', handleShowDialpad);

  // Back to idle button
  const backToIdleBtn = document.getElementById('back-to-idle-btn');
  backToIdleBtn?.addEventListener('click', handleBackToIdle);

  // Incoming call screen buttons
  const acceptBtn = document.getElementById('accept-btn');
  const declineBtn = document.getElementById('decline-btn');
  acceptBtn?.addEventListener('click', handleAcceptCall);
  declineBtn?.addEventListener('click', handleDeclineCall);

  // Active call screen buttons
  const endCallBtn = document.getElementById('end-call-btn');
  const keypadBtn = document.getElementById('keypad-btn');
  const speakerBtn = document.getElementById('speaker-btn');
  const closeDialpadBtn = document.getElementById('close-dialpad-btn');

  endCallBtn?.addEventListener('click', handleEndCall);
  keypadBtn?.addEventListener('click', handleToggleDialpad);
  speakerBtn?.addEventListener('click', handleToggleSpeaker);
  closeDialpadBtn?.addEventListener('click', handleToggleDialpad);

  // Action buttons
  const actionButtons = document.querySelectorAll('.action-btn');
  actionButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const target = e.currentTarget;
      const action = target.getAttribute('data-action');
      if (action) {
        handleActionButton(action);
      }
    });
  });

  // Dialpad digit buttons (in active call)
  const dialpadButtons = document.querySelectorAll('.dialpad-digit');
  dialpadButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const target = e.currentTarget;
      const digit = target.getAttribute('data-digit');
      if (digit) {
        handleDialpadDigit(digit);
      }
    });
  });

  // Idle screen dialpad buttons
  const idleDialpadButtons = document.querySelectorAll('.idle-dialpad-digit');
  idleDialpadButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const target = e.currentTarget;
      const digit = target.getAttribute('data-digit');
      if (digit) {
        handleIdleDialpadDigit(digit);
      }
    });
  });

  // Number display input
  const numberDisplay = document.getElementById('number-display');
  numberDisplay?.addEventListener('input', (e) => {
    const target = e.target;
    const cursorPosition = target.selectionStart;
    const oldLength = target.value.length;

    // Store the raw number (what user typed)
    currentNumber = target.value;

    // Format for display
    const formatted = formatPhoneNumberDisplay(currentNumber);
    const newLength = formatted.length;

    // Update display with formatted number
    target.value = formatted;
    currentNumber = formatted; // Store formatted version

    // Adjust cursor position after formatting
    const lengthDiff = newLength - oldLength;
    target.setSelectionRange(cursorPosition + lengthDiff, cursorPosition + lengthDiff);

    updateDialButtonState();
  });

  // Backspace icon button
  const backspaceIconBtn = document.getElementById('backspace-icon-btn');
  backspaceIconBtn?.addEventListener('click', handleBackspace);

  // Dial call button
  const dialCallBtn = document.getElementById('dial-call-btn');
  dialCallBtn?.addEventListener('click', handleDialCall);

  // Cancel call button (outgoing screen)
  const cancelCallBtn = document.getElementById('cancel-call-btn');
  cancelCallBtn?.addEventListener('click', handleEndCall);

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn?.addEventListener('click', handleLogout);

  // Twilio connection button
  const initTwilioBtn = document.getElementById('init-twilio-btn');
  initTwilioBtn?.addEventListener('click', handleInitTwilio);

  // Profile modal buttons
  const profileBtn = document.getElementById('profile-btn');
  const closeProfileBtn = document.getElementById('close-profile-btn');
  profileBtn?.addEventListener('click', handleOpenProfile);
  closeProfileBtn?.addEventListener('click', handleCloseProfile);
}

/**
 * Handle show dialpad screen
 */
function handleShowDialpad() {
  const idleScreen = document.getElementById('idle-screen');
  const dialpadScreen = document.getElementById('dialpad-screen');

  idleScreen?.classList.add('hidden');
  dialpadScreen?.classList.remove('hidden');
}

/**
 * Handle back to idle screen
 */
function handleBackToIdle() {
  const idleScreen = document.getElementById('idle-screen');
  const dialpadScreen = document.getElementById('dialpad-screen');

  dialpadScreen?.classList.add('hidden');
  idleScreen?.classList.remove('hidden');

  // Clear the number display
  currentNumber = '';
  const numberDisplay = document.getElementById('number-display');
  if (numberDisplay) {
    numberDisplay.value = '';
  }
  updateDialButtonState();
}

/**
 * Handle accept call
 */
function handleAcceptCall() {
  // Accept the call through Twilio
  if (twilioService.isReady()) {
    twilioService.acceptCall();
  }
  callStore.acceptCall();
}

/**
 * Handle decline call
 */
function handleDeclineCall() {
  // Reject the call through Twilio
  if (twilioService.isReady()) {
    twilioService.rejectCall();
  }
  callStore.declineCall();
}

/**
 * Handle end call
 */
function handleEndCall() {
  // Disconnect through Twilio
  if (twilioService.isReady()) {
    twilioService.disconnect();
  }
  callStore.endCall();
  // Reset UI states
  activeActions.clear();
  speakerActive = false;
}

/**
 * Handle toggle dialpad
 */
function handleToggleDialpad() {
  screenController.toggleDialpad();
}

/**
 * Handle toggle speaker
 */
function handleToggleSpeaker() {
  speakerActive = !speakerActive;
  screenController.toggleSpeaker(speakerActive);
  console.log('Speaker:', speakerActive ? 'ON' : 'OFF');
}

/**
 * Handle action button clicks
 */
function handleActionButton(action) {
  const isActive = activeActions.has(action);

  if (isActive) {
    activeActions.delete(action);
  } else {
    activeActions.add(action);
  }

  screenController.toggleActionButton(action, !isActive);
  console.log('Action:', action, !isActive ? 'ACTIVE' : 'INACTIVE');
}

/**
 * Handle dialpad digit press (during active call)
 */
function handleDialpadDigit(digit) {
  console.log('Dialpad digit:', digit);
  // Send DTMF tones through Twilio
  if (twilioService.isReady()) {
    twilioService.sendDigits(digit);
  }
}

/**
 * Handle idle dialpad digit press
 */
function handleIdleDialpadDigit(digit) {
  // Add the digit to current number
  currentNumber += digit;

  // Format for display
  const formatted = formatPhoneNumberDisplay(currentNumber);

  const numberDisplay = document.getElementById('number-display');
  if (numberDisplay) {
    numberDisplay.value = formatted;
    currentNumber = formatted; // Store formatted version
  }
  updateDialButtonState();
}

/**
 * Handle backspace button
 */
function handleBackspace() {
  if (currentNumber.length > 0) {
    currentNumber = currentNumber.slice(0, -1);
    const numberDisplay = document.getElementById('number-display');
    if (numberDisplay) {
      numberDisplay.value = currentNumber;
    }
    updateDialButtonState();
  }
}

/**
 * Handle dial call button
 */
async function handleDialCall() {
  if (currentNumber.trim().length > 0) {
    try {
      // Check if Twilio is connected
      if (!twilioService.isReady()) {
        alert('Please connect to Twilio first before making calls.');
        return;
      }

      // Normalize the number for the actual call (remove spaces, add +27)
      const normalizedNumber = normalizePhoneNumber(currentNumber);

      console.log('Making call to:', normalizedNumber, '(display:', currentNumber, ')');

      // Update UI to show outgoing call state (use display format)
      callStore.initiateCall(normalizedNumber);

      // Make the actual call through Twilio with normalized number (don't wait for customer lookup)
      await twilioService.makeCall(normalizedNumber);

      // Lookup customer info in the background (after call is already initiated)
      customerService.getCustomerByPhone(normalizedNumber).then(customer => {
        if (customer && callStore.state.state === 'outgoing' || callStore.state.state === 'active') {
          console.log('Customer found:', customer);
          const formattedInfo = customerService.formatCustomerInfo(customer);
          callStore.state.caller = {
            ...callStore.state.caller,
            name: formattedInfo.name,
            line1: formattedInfo.line1,
            line2: formattedInfo.line2,
          };
          callStore.notify();
        }
      }).catch(err => {
        console.log('Customer not found or lookup failed:', err);
      });

      // Clear the number display after initiating call
      currentNumber = '';
      const numberDisplay = document.getElementById('number-display');
      if (numberDisplay) {
        numberDisplay.value = '';
      }
      updateDialButtonState();
    } catch (error) {
      console.error('Failed to initiate call:', error);
      alert('Failed to make call: ' + error.message);
      // Reset call state on error
      callStore.resetCall();
    }
  }
}

/**
 * Update dial button and backspace icon state based on number input
 */
function updateDialButtonState() {
  const dialCallBtn = document.getElementById('dial-call-btn');
  const backspaceIconBtn = document.getElementById('backspace-icon-btn');
  const hasNumber = currentNumber.trim().length > 0;

  if (dialCallBtn) {
    dialCallBtn.disabled = !hasNumber;
  }

  if (backspaceIconBtn) {
    if (hasNumber) {
      backspaceIconBtn.classList.remove('hidden');
    } else {
      backspaceIconBtn.classList.add('hidden');
    }
  }
}

/**
 * Handle logout
 */
function handleLogout() {
  authService.logout();
  window.location.href = '/login.html';
}

/**
 * Handle open profile modal
 */
function handleOpenProfile() {
  const profileModal = document.getElementById('profile-modal');
  if (profileModal) {
    profileModal.classList.remove('hidden');
  }
}

/**
 * Handle close profile modal
 */
function handleCloseProfile() {
  const profileModal = document.getElementById('profile-modal');
  if (profileModal) {
    profileModal.classList.add('hidden');
  }
}

/**
 * Handle Twilio connection initialization
 */
async function handleInitTwilio() {
  const statusText = document.getElementById('twilio-status-text');
  const initBtn = document.getElementById('init-twilio-btn');

  // Don't try to reconnect if already connected
  if (twilioService.isReady()) {
    console.log('Twilio already connected');
    return;
  }

  try {
    // Update button state
    if (initBtn) {
      initBtn.disabled = true;
      initBtn.textContent = 'Connecting...';
    }

    if (statusText) {
      statusText.textContent = 'Connecting...';
    }

    // Fetch Twilio access token from backend
    const response = await fetch('http://localhost:3000/api/twilio/token', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Twilio token from backend');
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error('No token received from backend');
    }

    // Initialize Twilio with the access token
    await twilioService.initialize(data.token);

    // Set up Twilio event listeners
    twilioService.setListeners({
      onIncoming: (callInfo) => {
        console.log('Incoming call:', callInfo);

        // Show incoming call immediately
        callStore.receiveCall({
          name: callInfo.from,
          number: callInfo.from,
          location: ''
        });

        // Lookup customer info in the background (after call is already showing)
        customerService.getCustomerByPhone(callInfo.from).then(customer => {
          if (customer && callStore.state.state === 'incoming') {
            console.log('Customer found for incoming call:', customer);
            const formattedInfo = customerService.formatCustomerInfo(customer);
            callStore.state.caller = {
              ...callStore.state.caller,
              name: formattedInfo.name,
              line1: formattedInfo.line1,
              line2: formattedInfo.line2,
            };
            callStore.notify();
          }
        }).catch(err => {
          console.log('Customer not found or lookup failed:', err);
        });
      },
      onConnected: () => {
        console.log('Call connected');
      },
      onDisconnected: () => {
        console.log('Call disconnected');
        callStore.endCall();
      },
      onError: (error) => {
        console.error('Twilio error:', error);
        alert('Call error: ' + error.message);
      }
    });

    if (statusText) {
      statusText.textContent = 'Connected';
      statusText.classList.add('text-green-400');
    }

    // Update status indicator
    const statusIndicator = document.getElementById('twilio-status-indicator');
    if (statusIndicator) {
      statusIndicator.classList.remove('bg-white/30', 'bg-red-500');
      statusIndicator.classList.add('bg-green-500');
    }

    if (initBtn) {
      initBtn.textContent = '✓ Connected';
      initBtn.classList.remove('bg-cyan-500', 'hover:bg-cyan-600');
      initBtn.classList.add('bg-green-500', 'hover:bg-green-600', 'cursor-default');
      initBtn.disabled = true;
    }

    console.log('Twilio Device ready to make and receive calls');
  } catch (error) {
    console.error('Failed to initialize Twilio:', error);

    if (statusText) {
      statusText.textContent = 'Not connected';
      statusText.classList.remove('text-green-400');
      statusText.classList.add('text-red-400');
    }

    // Update status indicator
    const statusIndicator = document.getElementById('twilio-status-indicator');
    if (statusIndicator) {
      statusIndicator.classList.remove('bg-green-500', 'bg-white/30');
      statusIndicator.classList.add('bg-red-500');
    }

    if (initBtn) {
      initBtn.disabled = false;
      initBtn.textContent = 'Connect to Twilio';
      initBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
      initBtn.classList.add('bg-cyan-500', 'hover:bg-cyan-600');
    }

    // Don't show alert on auto-connect failure (silent fail for better UX)
    console.warn('Auto-connect failed. User can manually retry.');
  }
}
