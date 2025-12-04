/**
 * Authentication service - Frontend API client
 */

const API_URL = '/api';

class AuthService {
  constructor() {
    this.currentUser = null;
  }

  /**
   * Initialize auth service and check for existing session
   */
  async init() {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.currentUser = data.user;
      } else {
        // 401 is expected when not logged in - not an error
        this.currentUser = null;
      }
    } catch (error) {
      // Network errors only
      console.error('Network error during auth check:', error);
      this.currentUser = null;
    }
  }

  /**
   * Register a new user
   */
  async register(email, password, firstname, lastname, agent_id, company_id) {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          firstname,
          lastname,
          agent_id,
          company_id
        })
      });

      const data = await response.json();

      if (response.ok) {
        this.currentUser = data.user;
        console.log('✅ Registration successful');
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.detail || 'Failed to register' };
      }
    } catch (error) {
      console.error('Network error during registration:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  /**
   * Login user
   */
  async login(email, password) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await response.json();

      if (response.ok) {
        this.currentUser = data.user;
        console.log('✅ Login successful');
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.detail || 'Failed to login' };
      }
    } catch (error) {
      console.error('Network error during login:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.currentUser = null;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.currentUser !== null;
  }
}

// Export singleton instance
export const authService = new AuthService();
