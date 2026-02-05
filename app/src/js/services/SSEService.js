/**
 * Server-Sent Events (SSE) Service
 * Handles real-time streaming connection with auto-reconnection
 */

class SSEService {
  constructor() {
    this.eventSource = null;
    this.status = 'disconnected';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    this.listeners = {
      onMessage: null,
      onStatusChange: null,
      onError: null
    };
  }

  /**
   * Connect to SSE stream
   * @param {string} url - The SSE endpoint URL
   */
  connect(url) {
    if (this.eventSource) {
      console.log('SSE: Already connected, disconnecting first');
      this.disconnect();
    }

    console.log('SSE: Connecting to', url);
    this.updateStatus('connecting');

    try {
      // Native EventSource automatically sends cookies for same-origin requests
      this.eventSource = new EventSource(url);

      // Connection opened
      this.eventSource.onopen = () => {
        console.log('SSE: Connection established');
        this.updateStatus('connected');
        this.reconnectAttempts = 0; // Reset on successful connection
      };

      // Message received
      this.eventSource.onmessage = (event) => {
        console.log('SSE: Message received', event.data);
        if (this.listeners.onMessage) {
          try {
            const data = JSON.parse(event.data);
            this.listeners.onMessage(data);
          } catch (error) {
            console.error('SSE: Error parsing message', error);
          }
        }
      };

      // Error occurred
      this.eventSource.onerror = (error) => {
        console.error('SSE: Connection error', error);

        if (this.listeners.onError) {
          this.listeners.onError(error);
        }

        // EventSource automatically reconnects on error unless closed
        // We handle manual reconnection with backoff if needed
        if (this.eventSource.readyState === EventSource.CLOSED) {
          this.updateStatus('disconnected');
          this.handleReconnect();
        }
      };
    } catch (error) {
      console.error('SSE: Failed to create EventSource', error);
      this.updateStatus('disconnected');
      if (this.listeners.onError) {
        this.listeners.onError(error);
      }
    }
  }

  /**
   * Disconnect from SSE stream
   * CRITICAL: Must be called when navigating away to prevent memory leaks
   */
  disconnect() {
    console.log('SSE: Disconnecting');

    // Clear any pending reconnection timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close EventSource connection
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.updateStatus('disconnected');
    this.reconnectAttempts = 0;
  }

  /**
   * Handle reconnection with exponential backoff
   */
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('SSE: Max reconnection attempts reached');
      this.updateStatus('disconnected');
      if (this.listeners.onError) {
        this.listeners.onError(new Error('Max reconnection attempts reached'));
      }
      return;
    }

    this.reconnectAttempts++;

    // Exponential backoff: min(1000 * 2^(attempt-1) + jitter, 30000)
    const baseDelay = 1000 * Math.pow(2, this.reconnectAttempts - 1);
    const jitter = Math.random() * 1000;
    const delay = Math.min(baseDelay + jitter, 30000);

    console.log(`SSE: Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      console.log('SSE: Attempting reconnection...');
      // Store URL before disconnect
      const lastUrl = this.eventSource ? this.eventSource.url : null;
      this.disconnect();
      if (lastUrl) {
        this.connect(lastUrl);
      }
    }, delay);
  }

  /**
   * Set event listeners
   * @param {Object} listeners - Event listener callbacks
   * @param {Function} listeners.onMessage - Called when message received
   * @param {Function} listeners.onStatusChange - Called when connection status changes
   * @param {Function} listeners.onError - Called when error occurs
   */
  setListeners(listeners) {
    this.listeners = {
      ...this.listeners,
      ...listeners
    };
  }

  /**
   * Get current connection status
   * @returns {string} - 'disconnected', 'connecting', or 'connected'
   */
  getStatus() {
    return this.status;
  }

  /**
   * Update connection status and notify listeners
   * @param {string} newStatus - The new status
   */
  updateStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      console.log('SSE: Status changed to', newStatus);

      if (this.listeners.onStatusChange) {
        this.listeners.onStatusChange(newStatus, this.reconnectAttempts);
      }
    }
  }
}

// Export singleton instance
export const sseService = new SSEService();
