/**
 * Task Service
 * Handles task creation and management
 */
import { API_BASE_URL } from '../../config.js';


class TaskService {
  /**
   * Create a new task
   * @param {Object} taskData - Task data
   * @param {number} taskData.assigned_to - User ID to assign task to
   * @param {string} taskData.title - Task title
   * @param {string} taskData.description - Task description
   * @param {string} taskData.type - Task type (task, follow-up, callback, review)
   * @param {string} taskData.status - Task status (pending, in_progress, completed)
   * @param {string} taskData.due_date - Due date (ISO format)
   * @param {number} taskData.customer_id - Optional customer ID
   * @param {number} taskData.call_id - Optional call ID
   * @returns {Promise<Object>} Created task or error
   */
  async createTask(taskData) {
    try {
      const url = `${API_BASE_URL}/api/tasks`;
      console.log('📋 Creating task at:', url);
      console.log('📤 Request data:', taskData);

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      console.log('📡 Response status:', response.status, response.statusText);

      const data = await response.json();
      console.log('📦 Response data:', data);

      if (!response.ok) {
        console.error('❌ Failed to create task:', data.detail || response.statusText);
        return {
          success: false,
          error: data.detail || 'Failed to create task',
        };
      }

      if (data.success && data.task) {
        console.log('✅ Task created successfully:', data.task);
        return {
          success: true,
          task: data.task,
        };
      }

      return {
        success: false,
        error: 'Unexpected response format',
      };
    } catch (error) {
      console.error('❌ Network error creating task:', error);
      console.error('❌ Error details:', error.message, error.stack);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Get all tasks for the current user
   * @returns {Promise<Object>} Tasks or error
   */
  async getTasks() {
    try {
      const url = `${API_BASE_URL}/api/tasks`;
      console.log('📋 Fetching tasks from:', url);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Response status:', response.status, response.statusText);

      const data = await response.json();
      console.log('📦 Response data:', data);

      if (!response.ok) {
        console.error('❌ Failed to fetch tasks:', data.detail || response.statusText);
        return {
          success: false,
          error: data.detail || 'Failed to fetch tasks',
        };
      }

      if (data.success && data.tasks) {
        console.log('✅ Successfully loaded', data.tasks.length, 'tasks');
        return {
          success: true,
          tasks: data.tasks,
        };
      }

      return {
        success: false,
        error: 'Unexpected response format',
      };
    } catch (error) {
      console.error('❌ Network error fetching tasks:', error);
      console.error('❌ Error details:', error.message, error.stack);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Get task statistics for the current user
   * @param {Object} filters - Optional filters
   * @param {string} filters.type - Task type filter (e.g., 'follow-up', 'callback')
   * @param {string} filters.time - Time filter (e.g., 'overdue', 'today', 'next7days')
   * @returns {Promise<Object>} Task statistics or error
   */
  async getTaskStats(filters = {}) {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.type) {
        params.append('type', filters.type);
      }
      if (filters.time) {
        params.append('time', filters.time);
      }

      const queryString = params.toString();
      const url = `${API_BASE_URL}/api/tasks/stats${queryString ? '?' + queryString : ''}`;
      console.log('📊 Fetching task stats from:', url);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Response status:', response.status, response.statusText);

      const data = await response.json();
      console.log('📦 Response data:', data);

      if (!response.ok) {
        console.error('❌ Failed to fetch task stats:', data.detail || response.statusText);
        return {
          success: false,
          error: data.detail || 'Failed to fetch task stats',
        };
      }

      if (data.success) {
        console.log('✅ Task stats loaded successfully');
        return {
          success: true,
          stats: {
            totalTasks: data.total_tasks || 0,
            pendingTasks: data.pending_tasks || 0,
            inProgressTasks: data.in_progress_tasks || 0,
            completedTasks: data.completed_tasks || 0,
            followUpTasks: data.follow_up_tasks || 0,
            callbackTasks: data.callback_tasks || 0,
            overdueTasks: data.overdue_tasks || 0,
            outstandingTasks: data.outstanding_tasks || 0,
          },
        };
      }

      return {
        success: false,
        error: 'Unexpected response format',
      };
    } catch (error) {
      console.error('❌ Network error fetching task stats:', error);
      console.error('❌ Error details:', error.message, error.stack);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Get tasks for a specific customer
   * @param {number} customerId - Customer ID
   * @returns {Promise<Object>} Tasks or error
   */
  async getTasksByCustomer(customerId) {
    try {
      const url = `${API_BASE_URL}/api/tasks?customer_id=${customerId}`;
      console.log('📋 Fetching tasks for customer:', customerId);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Failed to fetch customer tasks:', data.detail || response.statusText);
        return {
          success: false,
          error: data.detail || 'Failed to fetch customer tasks',
          tasks: [],
        };
      }

      if (data.success && data.tasks) {
        console.log('✅ Successfully loaded', data.tasks.length, 'tasks for customer');
        return {
          success: true,
          tasks: data.tasks,
        };
      }

      return {
        success: true,
        tasks: [],
      };
    } catch (error) {
      console.error('❌ Network error fetching customer tasks:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
        tasks: [],
      };
    }
  }
}

export const taskService = new TaskService();
