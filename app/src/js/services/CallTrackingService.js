/**
 * CallTrackingService - Handles call tracking to database
 */

import { API_BASE_URL } from '../../config.js';

export class CallTrackingService {
  constructor() {
    this.activeCallSid = null;
    this.callStartTime = null;
  }

  /**
   * Record a new call in the database
   * @param {Object} callData - Call information
   * @param {string} callData.call_sid - Unique call identifier
   * @param {string} callData.from_number - Caller's phone number
   * @param {string} callData.to_number - Recipient's phone number
   * @param {string} callData.call_status - Call status (initiated, ringing, in-progress, etc.)
   * @param {number} callData.customer_id - Optional customer ID
   */
  async recordCall(callData) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          call_sid: callData.call_sid,
          from_number: callData.from_number,
          to_number: callData.to_number,
          call_status: callData.call_status || 'initiated',
          duration: callData.duration || 0,
          customer_id: callData.customer_id || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to record call:', data);
        return null;
      }

      console.log('Call recorded successfully:', callData.call_sid);
      this.activeCallSid = callData.call_sid;
      this.callStartTime = Date.now();

      return data;
    } catch (error) {
      console.error('Error recording call:', error);
      return null;
    }
  }

  /**
   * Update call record with final status and duration
   * @param {string} callSid - Call SID to update
   * @param {string} callStatus - Final call status (completed, no-answer, busy, failed)
   * @param {number} duration - Call duration in seconds
   */
  async updateCall(callSid, callStatus, duration) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/calls/${callSid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          call_status: callStatus,
          duration: duration,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to update call:', data);
        return null;
      }

      console.log('Call updated successfully:', callSid, callStatus, duration);

      // Reset active call tracking
      if (callSid === this.activeCallSid) {
        this.activeCallSid = null;
        this.callStartTime = null;
      }

      return data;
    } catch (error) {
      console.error('Error updating call:', error);
      return null;
    }
  }

  /**
   * End the current active call and update with duration
   * @param {string} callStatus - Final status
   */
  async endActiveCall(callStatus = 'completed') {
    if (!this.activeCallSid || !this.callStartTime) {
      console.warn('No active call to end');
      return null;
    }

    const duration = Math.floor((Date.now() - this.callStartTime) / 1000);
    return await this.updateCall(this.activeCallSid, callStatus, duration);
  }

  /**
   * Get call statistics for today
   */
  async getCallStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/calls/stats`, {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to get call stats:', data);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting call stats:', error);
      return null;
    }
  }

  /**
   * Get the current active call SID
   */
  getActiveCallSid() {
    return this.activeCallSid;
  }

  /**
   * Get the current call duration in seconds
   */
  getCurrentCallDuration() {
    if (!this.callStartTime) return 0;
    return Math.floor((Date.now() - this.callStartTime) / 1000);
  }

  /**
   * Get call history for a specific customer
   * @param {number} customerId - Customer ID
   * @returns {Promise<Object>} Call history or null
   */
  async getCallsByCustomer(customerId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/calls/customer/${customerId}`, {
        method: 'GET',
        credentials: 'include',
      });

      // Handle 404 or 405 gracefully - endpoint may not exist yet
      if (response.status === 404 || response.status === 405) {
        console.log('Call history by customer endpoint not available');
        return { success: true, calls: [] };
      }

      if (!response.ok) {
        return { success: false, calls: [] };
      }

      const data = await response.json();
      return {
        success: true,
        calls: data.calls || [],
      };
    } catch (error) {
      // Silently handle - endpoint may not be implemented
      console.log('Call history lookup not available:', error.message);
      return { success: true, calls: [] };
    }
  }

  /**
   * Get call history by phone number
   * @param {string} phoneNumber - Phone number to lookup
   * @returns {Promise<Object>} Call history or null
   */
  async getCallsByPhone(phoneNumber) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/calls/phone/${encodeURIComponent(phoneNumber)}`, {
        method: 'GET',
        credentials: 'include',
      });

      // Handle 404 or 405 gracefully - endpoint may not exist yet
      if (response.status === 404 || response.status === 405) {
        console.log('Call history by phone endpoint not available');
        return { success: true, calls: [] };
      }

      if (!response.ok) {
        return { success: false, calls: [] };
      }

      const data = await response.json();
      return {
        success: true,
        calls: data.calls || [],
      };
    } catch (error) {
      // Silently handle - endpoint may not be implemented
      console.log('Call history lookup not available:', error.message);
      return { success: true, calls: [] };
    }
  }
}

// Export singleton instance
export const callTrackingService = new CallTrackingService();
