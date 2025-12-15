/**
 * Customer Service
 * Handles customer lookup and information retrieval
 */

const API_BASE_URL = 'http://localhost:3000';

class CustomerService {
  /**
   * Get customer information by phone number
   * @param {string} phoneNumber - The phone number to lookup
   * @returns {Promise<Object|null>} Customer information or null if not found
   */
  async getCustomerByPhone(phoneNumber) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/customers/by-phone?phone=${encodeURIComponent(phoneNumber)}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error('Failed to fetch customer:', response.statusText);
        return null;
      }

      const data = await response.json();

      if (data.success && data.customer) {
        return data.customer;
      }

      return null;
    } catch (error) {
      console.error('Error fetching customer:', error);
      return null;
    }
  }

  /**
   * Format customer display name
   * @param {Object} customer - Customer object
   * @returns {string} Formatted display name
   */
  formatDisplayName(customer) {
    if (!customer) return null;
    return `${customer.first_name} ${customer.last_name}`;
  }

  /**
   * Format customer info for caller ID display
   * @param {Object} customer - Customer object
   * @returns {Object} Formatted customer info with name, line1 (medical aid), line2 (plan)
   */
  formatCustomerInfo(customer) {
    if (!customer) return null;

    return {
      name: this.formatDisplayName(customer),
      line1: customer.medical_aid_provider?.String || '',
      line2: customer.medical_plan?.String ? `(${customer.medical_plan.String})` : '',
    };
  }
}

export const customerService = new CustomerService();
