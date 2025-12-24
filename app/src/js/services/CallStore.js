/**
 * CallStore - State management for phone calls
 * Simple observable store pattern for managing call state
 */

export class CallStore {
  constructor() {
    this.state = {
      state: 'idle',
      caller: null,
      duration: 0,
      startTime: null
    };

    this.listeners = new Set();
    this.durationTimer = null;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener) {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  notify() {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Simulate an incoming call
   */
  receiveCall(caller) {
    this.state = {
      state: 'incoming',
      caller,
      duration: 0,
      startTime: null
    };
    this.notify();
  }

  /**
   * Initiate an outgoing call
   */
  async initiateCall(number, callerInfo) {
    // If callerInfo is provided, use it; otherwise, create a default caller object
    const caller = callerInfo || {
      name: number,
      number: number,
      line1: '',
      line2: '',
    };

    this.state = {
      state: 'outgoing',
      caller,
      duration: 0,
      startTime: null
    };
    this.notify();

    // Simulation mode
    this.simulateConnection();
  }

  /**
   * Simulate call connection
   */
  simulateConnection() {
    setTimeout(() => {
      if (this.state.state === 'outgoing') {
        this.state = {
          ...this.state,
          state: 'active',
          startTime: Date.now()
        };
        this.startDurationTimer();
        this.notify();
      }
    }, 2000);
  }

  /**
   * Accept the incoming call
   */
  acceptCall() {
    if (this.state.state === 'incoming') {
      this.state = {
        ...this.state,
        state: 'active',
        startTime: Date.now()
      };
      this.startDurationTimer();
      this.notify();
    }
  }

  /**
   * Decline the incoming call
   */
  declineCall() {
    if (this.state.state === 'incoming') {
      this.state = {
        ...this.state,
        state: 'ended'
      };
      this.notify();

      // Reset to idle after 2 seconds
      setTimeout(() => {
        this.resetCall();
      }, 2000);
    }
  }

  /**
   * End the active call or cancel outgoing call
   */
  endCall() {
    if (this.state.state === 'active') {
      this.stopDurationTimer();
      this.state = {
        ...this.state,
        state: 'ended'
      };
      this.notify();

      // Reset to idle after 2 seconds
      setTimeout(() => {
        this.resetCall();
      }, 2000);
    } else if (this.state.state === 'outgoing') {
      // Cancel outgoing call
      this.state = {
        ...this.state,
        state: 'ended'
      };
      this.notify();

      // Reset to idle after 1 second
      setTimeout(() => {
        this.resetCall();
      }, 1000);
    }
  }

  /**
   * Reset the call state to idle
   */
  resetCall() {
    this.state = {
      state: 'idle',
      caller: null,
      duration: 0,
      startTime: null
    };
    this.notify();
  }

  /**
   * Start the duration timer
   */
  startDurationTimer() {
    this.durationTimer = window.setInterval(() => {
      if (this.state.startTime) {
        this.state.duration = Math.floor((Date.now() - this.state.startTime) / 1000);
        this.notify();
      }
    }, 1000);
  }

  /**
   * Stop the duration timer
   */
  stopDurationTimer() {
    if (this.durationTimer !== null) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
  }
}

// Export singleton instance
export const callStore = new CallStore();
