/**
 * TwilioService - Manages Twilio Voice SDK integration
 * Handles device initialization, incoming/outgoing calls, and call state
 */

import { callTrackingService } from './CallTrackingService.js';

export class TwilioService {
  constructor() {
    this.device = null;
    this.currentConnection = null;
    this.isInitialized = false;
    this.listeners = {
      onIncoming: null,
      onConnected: null,
      onDisconnected: null,
      onError: null,
      onMissedCall: null,
      onTokenWillExpire: null,
      onTokenRefreshed: null
    };
    this.callTrackingService = callTrackingService;
    // Track incoming call details for missed call recording
    this.pendingIncomingCall = null;
    // Track if token refresh is in progress to avoid duplicate requests
    this.isRefreshingToken = false;
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

      // Track incoming call details for potential missed call recording
      this.pendingIncomingCall = {
        callSid: connection.parameters.CallSid,
        from: connection.parameters.From,
        to: connection.parameters.To || connection.parameters.Called,
        startTime: Date.now()
      };

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

    // Handle token expiration warning - fires ~10 seconds before token expires
    this.device.on('tokenWillExpire', () => {
      console.log('Twilio token will expire soon, requesting refresh...');
      if (this.listeners.onTokenWillExpire) {
        this.listeners.onTokenWillExpire();
      }
    });
  }

  /**
   * Set up connection event handlers
   * @param {Object} connection - Twilio connection object
   */
  setupConnectionHandlers(connection) {
    connection.on('accept', async () => {
      console.log('Call accepted');

      // Clear pending incoming call since it was answered
      this.pendingIncomingCall = null;

      // Track call start
      const callSid = connection.parameters.CallSid;
      const fromNumber = connection.parameters.From || connection.customParameters?.From;
      const toNumber = connection.parameters.To || connection.customParameters?.To;

      if (callSid && fromNumber && toNumber) {
        await this.callTrackingService.recordCall({
          call_sid: callSid,
          from_number: fromNumber,
          to_number: toNumber,
          call_status: 'in-progress',
        });
      }

      if (this.listeners.onConnected) {
        this.listeners.onConnected();
      }
    });

    connection.on('disconnect', async () => {
      console.log('Call disconnected');

      // Update call with final status and duration
      await this.callTrackingService.endActiveCall('completed');

      this.pendingIncomingCall = null;
      this.currentConnection = null;
      if (this.listeners.onDisconnected) {
        this.listeners.onDisconnected();
      }
    });

    connection.on('reject', async () => {
      console.log('Call rejected');

      // Record as missed call if we have pending incoming call info
      if (this.pendingIncomingCall) {
        await this.recordMissedCall(this.pendingIncomingCall, 'no-answer');
      } else {
        // Update call as rejected/no-answer
        await this.callTrackingService.endActiveCall('no-answer');
      }

      this.pendingIncomingCall = null;
      this.currentConnection = null;
      if (this.listeners.onDisconnected) {
        this.listeners.onDisconnected();
      }
    });

    // Handle caller hanging up before answer (missed call)
    connection.on('cancel', async () => {
      console.log('Call cancelled - caller hung up before answer');

      // Record as missed call
      if (this.pendingIncomingCall) {
        await this.recordMissedCall(this.pendingIncomingCall, 'no-answer');

        // Notify listener about missed call
        if (this.listeners.onMissedCall) {
          this.listeners.onMissedCall(this.pendingIncomingCall);
        }
      }

      this.pendingIncomingCall = null;
      this.currentConnection = null;
      if (this.listeners.onDisconnected) {
        this.listeners.onDisconnected();
      }
    });

    connection.on('error', async (error) => {
      console.error('Connection error:', error);

      // Record as failed call if we have pending incoming call info
      if (this.pendingIncomingCall) {
        await this.recordMissedCall(this.pendingIncomingCall, 'failed');
      } else {
        // Update call as failed
        await this.callTrackingService.endActiveCall('failed');
      }

      this.pendingIncomingCall = null;
      if (this.listeners.onError) {
        this.listeners.onError(error);
      }
    });
  }

  /**
   * Record a missed call to the database
   * @param {Object} callInfo - The pending incoming call info
   * @param {string} status - The call status (no-answer, failed)
   */
  async recordMissedCall(callInfo, status = 'no-answer') {
    try {
      console.log('Recording missed call:', callInfo.callSid, 'Status:', status);

      // Record the call with missed status
      await this.callTrackingService.recordCall({
        call_sid: callInfo.callSid,
        from_number: callInfo.from,
        to_number: callInfo.to,
        call_status: status,
        duration: 0
      });

      console.log('Missed call recorded successfully');
    } catch (error) {
      console.error('Failed to record missed call:', error);
    }
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

  /**
   * Update the access token without reinitializing the device
   * This should be called when receiving a new token before the old one expires
   * @param {string} newToken - The new Twilio access token
   */
  async updateToken(newToken) {
    if (!this.device) {
      console.warn('Cannot update token: Twilio Device not initialized');
      return false;
    }

    if (this.isRefreshingToken) {
      console.log('Token refresh already in progress, skipping...');
      return false;
    }

    this.isRefreshingToken = true;

    try {
      await this.device.updateToken(newToken);
      console.log('Twilio token updated successfully');

      if (this.listeners.onTokenRefreshed) {
        this.listeners.onTokenRefreshed();
      }

      return true;
    } catch (error) {
      console.error('Failed to update Twilio token:', error);
      throw error;
    } finally {
      this.isRefreshingToken = false;
    }
  }

  /**
   * Check if the device needs token refresh
   * @returns {boolean} - True if token refresh is in progress
   */
  isTokenRefreshInProgress() {
    return this.isRefreshingToken;
  }
}

// Export singleton instance
export const twilioService = new TwilioService();
