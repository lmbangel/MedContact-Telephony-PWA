/**
 * ScreenController - Manages screen transitions and UI updates
 */

export class ScreenController {
  constructor() {
    this.incomingScreen = this.getElement('incoming-call-screen');
    this.outgoingScreen = this.getElement('outgoing-call-screen');
    this.activeScreen = this.getElement('active-call-screen');
    this.idleScreen = this.getElement('idle-screen');
    this.dialpadScreen = this.getElement('dialpad-screen');
  }

  getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Element with id "${id}" not found`);
    }
    return element;
  }

  /**
   * Update UI based on call state
   */
  updateScreen(state) {
    // Hide all screens first
    this.hideAllScreens();

    // Show appropriate screen based on state
    switch (state.state) {
      case 'incoming':
        this.showIncomingScreen(state);
        break;
      case 'outgoing':
        this.showOutgoingScreen(state);
        break;
      case 'active':
        this.showActiveScreen(state);
        break;
      case 'idle':
      case 'ended':
      default:
        this.showIdleScreen();
        break;
    }
  }

  hideAllScreens() {
    this.incomingScreen.classList.add('hidden');
    this.outgoingScreen.classList.add('hidden');
    this.activeScreen.classList.add('hidden');
    this.idleScreen.classList.add('hidden');
    this.dialpadScreen.classList.add('hidden');
  }

  showIncomingScreen(state) {
    if (!state.caller) return;

    // Update caller info
    const nameEl = document.getElementById('incoming-caller-name');
    const locationEl = document.getElementById('incoming-caller-location');
    const line1El = document.getElementById('incoming-caller-line1');
    const line2El = document.getElementById('incoming-caller-line2');

    if (nameEl) nameEl.textContent = state.caller.name;
    if (locationEl) locationEl.textContent = state.caller.location || state.caller.number || '';
    if (line1El) line1El.textContent = state.caller.line1 || '';
    if (line2El) line2El.textContent = state.caller.line2 || '';

    this.incomingScreen.classList.remove('hidden');
  }

  showOutgoingScreen(state) {
    if (!state.caller) return;

    // Update caller info
    const nameEl = document.getElementById('outgoing-caller-name');
    const numberEl = document.getElementById('outgoing-caller-number');
    const line1El = document.getElementById('outgoing-caller-line1');
    const line2El = document.getElementById('outgoing-caller-line2');

    if (nameEl) nameEl.textContent = state.caller.name;
    if (numberEl) numberEl.textContent = state.caller.number || '';
    if (line1El) line1El.textContent = state.caller.line1 || '';
    if (line2El) line2El.textContent = state.caller.line2 || '';

    this.outgoingScreen.classList.remove('hidden');
  }

  showActiveScreen(state) {
    if (!state.caller) return;

    // Update caller info
    const nameEl = document.getElementById('active-caller-name');
    const locationEl = document.getElementById('active-caller-location');
    const line1El = document.getElementById('active-caller-line1');
    const line2El = document.getElementById('active-caller-line2');
    const durationEl = document.getElementById('call-duration');

    if (nameEl) nameEl.textContent = state.caller.name;
    if (locationEl) locationEl.textContent = state.caller.location || state.caller.number || '';
    if (line1El) line1El.textContent = state.caller.line1 || '';
    if (line2El) line2El.textContent = state.caller.line2 || '';
    if (durationEl) durationEl.textContent = this.formatDuration(state.duration);

    this.activeScreen.classList.remove('hidden');
  }

  showIdleScreen() {
    this.idleScreen.classList.remove('hidden');
  }

  /**
   * Format duration as MM:SS
   */
  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Toggle dialpad visibility
   */
  toggleDialpad() {
    const dialpad = document.getElementById('dialpad-overlay');
    const keypadBtn = document.getElementById('keypad-btn');

    if (dialpad) {
      const isHidden = dialpad.classList.contains('hidden');
      if (isHidden) {
        dialpad.classList.remove('hidden');
        keypadBtn?.classList.add('bg-white/30');
        keypadBtn?.classList.remove('bg-white/10');
      } else {
        dialpad.classList.add('hidden');
        keypadBtn?.classList.remove('bg-white/30');
        keypadBtn?.classList.add('bg-white/10');
      }
    }
  }

  /**
   * Toggle speaker state
   */
  toggleSpeaker(isActive) {
    const speakerBtn = document.getElementById('speaker-btn');
    if (speakerBtn) {
      if (isActive) {
        speakerBtn.classList.add('bg-white/30');
        speakerBtn.classList.remove('bg-white/10');
      } else {
        speakerBtn.classList.remove('bg-white/30');
        speakerBtn.classList.add('bg-white/10');
      }
    }
  }

  /**
   * Toggle action button state
   */
  toggleActionButton(action, isActive) {
    const button = document.querySelector(`[data-action="${action}"]`);
    if (button) {
      if (isActive) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    }
  }
}
