/**
 * TwilioService - Manages Twilio Voice SDK integration
 * Handles device initialization, incoming/outgoing calls, and call state
 */

export class TwilioService {
  constructor() {
    this.device = null;
    this.currentConnection = null;
    this.isInitialized = false;
    this.listeners = {
      onIncoming: null,
      onConnected: null,
      onDisconnected: null,
      onError: null
    };
  }

  /**
   * Initialize Twilio Device with access token
   * @param {string} accessToken - Twilio access token from backend
   */
  async initialize(accessToken) {
    try {
      // Check if Twilio SDK is loaded
      if (typeof Twilio === 'undefined' || !Twilio.Device) {
        throw new Error('Twilio Voice SDK not loaded. Please check your script tags.');
      }

      // Create new device instance
      this.device = new Twilio.Device(accessToken, {
        codecPreferences: ['opus', 'pcmu'],
        fakeLocalDTMF: true,
        enableRingingState: true
      });

      // Set up device event handlers
      this.setupDeviceHandlers();

      // Register the device
      await this.device.register();

      this.isInitialized = true;
      console.log('Twilio Device initialized and registered successfully');

      return true;
    } catch (error) {
      console.error('Failed to initialize Twilio Device:', error);
      throw error;
    }
  }

  /**
   * Set up Twilio Device event handlers
   */
  setupDeviceHandlers() {
    if (!this.device) return;

    // Handle incoming calls
    this.device.on('incoming', (connection) => {
      console.log('Incoming call from:', connection.parameters.From);
      this.currentConnection = connection;

      // Set up connection handlers
      this.setupConnectionHandlers(connection);

      // Notify listener
      if (this.listeners.onIncoming) {
        this.listeners.onIncoming({
          from: connection.parameters.From,
          customParameters: connection.customParameters
        });
      }
    });

    // Handle device ready state
    this.device.on('registered', () => {
      console.log('Twilio Device is ready to receive calls');
    });

    // Handle device errors
    this.device.on('error', (error) => {
      console.error('Twilio Device error:', error);
      if (this.listeners.onError) {
        this.listeners.onError(error);
      }
    });

    // Handle device disconnection
    this.device.on('unregistered', () => {
      console.log('Twilio Device unregistered');
    });
  }

  /**
   * Set up connection event handlers
   * @param {Object} connection - Twilio connection object
   */
  setupConnectionHandlers(connection) {
    connection.on('accept', () => {
      console.log('Call accepted');
      if (this.listeners.onConnected) {
        this.listeners.onConnected();
      }
    });

    connection.on('disconnect', () => {
      console.log('Call disconnected');
      this.currentConnection = null;
      if (this.listeners.onDisconnected) {
        this.listeners.onDisconnected();
      }
    });

    connection.on('reject', () => {
      console.log('Call rejected');
      this.currentConnection = null;
      if (this.listeners.onDisconnected) {
        this.listeners.onDisconnected();
      }
    });

    connection.on('error', (error) => {
      console.error('Connection error:', error);
      if (this.listeners.onError) {
        this.listeners.onError(error);
      }
    });
  }

  /**
   * Make an outgoing call
   * @param {string} phoneNumber - Phone number to call
   * @param {Object} params - Optional call parameters
   */
  async makeCall(phoneNumber, params = {}) {
    if (!this.isInitialized || !this.device) {
      throw new Error('Twilio Device not initialized');
    }

    try {
      const callParams = {
        To: phoneNumber,
        ...params
      };

      this.currentConnection = await this.device.connect({ params: callParams });
      this.setupConnectionHandlers(this.currentConnection);

      console.log('Outgoing call initiated to:', phoneNumber);
      return this.currentConnection;
    } catch (error) {
      console.error('Failed to make call:', error);
      throw error;
    }
  }

  /**
   * Accept an incoming call
   */
  acceptCall() {
    if (this.currentConnection) {
      this.currentConnection.accept();
      console.log('Incoming call accepted');
    } else {
      console.warn('No incoming call to accept');
    }
  }

  /**
   * Reject an incoming call
   */
  rejectCall() {
    if (this.currentConnection) {
      this.currentConnection.reject();
      this.currentConnection = null;
      console.log('Incoming call rejected');
    } else {
      console.warn('No incoming call to reject');
    }
  }

  /**
   * Disconnect the current call
   */
  disconnect() {
    if (this.currentConnection) {
      this.currentConnection.disconnect();
      this.currentConnection = null;
      console.log('Call disconnected');
    } else {
      console.warn('No active call to disconnect');
    }
  }

  /**
   * Send DTMF tones during a call
   * @param {string} digit - DTMF digit to send
   */
  sendDigits(digit) {
    if (this.currentConnection) {
      this.currentConnection.sendDigits(digit);
      console.log('Sent DTMF digit:', digit);
    }
  }

  /**
   * Mute the microphone
   * @param {boolean} muted - True to mute, false to unmute
   */
  mute(muted) {
    if (this.currentConnection) {
      this.currentConnection.mute(muted);
      console.log('Microphone muted:', muted);
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    if (!this.currentConnection) {
      return 'idle';
    }
    return this.currentConnection.status();
  }

  /**
   * Check if device is initialized
   */
  isReady() {
    return this.isInitialized && this.device !== null;
  }

  /**
   * Set event listeners
   * @param {Object} listeners - Object containing event listener callbacks
   */
  setListeners(listeners) {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * Destroy the device and clean up
   */
  destroy() {
    if (this.currentConnection) {
      this.currentConnection.disconnect();
    }

    if (this.device) {
      this.device.unregister();
      this.device.destroy();
      this.device = null;
    }

    this.isInitialized = false;
    this.currentConnection = null;
    console.log('Twilio Device destroyed');
  }
}

// Export singleton instance
export const twilioService = new TwilioService();
