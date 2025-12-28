// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  // Auth
  REGISTER: `${API_URL}/api/auth/register`,
  LOGIN: `${API_URL}/api/auth/login`,
  LOGOUT: `${API_URL}/api/auth/logout`,
  ME: `${API_URL}/api/auth/me`,
  SEND_OTP: `${API_URL}/api/auth/otp/send`,
  VERIFY_OTP: `${API_URL}/api/auth/otp/verify`,

  // Companies
  COMPANIES: `${API_URL}/api/companies`,

  // Customers
  CUSTOMER_BY_PHONE: (phone) => `${API_URL}/api/customers/by-phone?phone=${encodeURIComponent(phone)}`,

  // Twilio
  TWILIO_TOKEN: `${API_URL}/api/twilio/token`,

  // Agent Status
  AGENT_STATUS: `${API_URL}/api/agent/status`,
};
