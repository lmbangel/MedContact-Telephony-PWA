package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"omnicall/db"
	"strconv"
	"time"
)

type StatsHandler struct {
	queries *db.Queries
}

func NewStatsHandler(queries *db.Queries) *StatsHandler {
	return &StatsHandler{queries: queries}
}

// GET /api/stats/tasks - Role-based task statistics
func (h *StatsHandler) GetTaskStats(w http.ResponseWriter, r *http.Request) {
	// Extract authenticated user from session cookie
	cookie, err := r.Cookie("session_id")
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	session, err := h.queries.GetSession(r.Context(), cookie.Value)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Session expired")
		return
	}

	// Check if session is expired
	if time.Now().After(session.ExpiresAt) {
		h.queries.DeleteSession(r.Context(), session.ID)
		respondError(w, http.StatusUnauthorized, "Session expired")
		return
	}

	user, err := h.queries.GetUserByID(r.Context(), session.UserID)
	if err != nil {
		respondError(w, http.StatusNotFound, "User not found")
		return
	}

	// Route to appropriate query based on role
	var stats interface{}
	switch user.Role {
	case "admin":
		// Admin gets stats for all users in their company
		stats, err = h.queries.GetTaskStatsByCompany(r.Context(), user.CompanyID)
		if err != nil {
			log.Printf("Failed to get admin task stats: %v", err)
			respondError(w, http.StatusInternalServerError, "Failed to get task stats")
			return
		}

	case "manager", "supervisor":
		// Manager gets stats for their subordinates
		stats, err = h.queries.GetTaskStatsByManager(r.Context(), db.GetTaskStatsByManagerParams{
			ReportsTo: sql.NullInt32{Int32: user.ID, Valid: true},
			CompanyID: user.CompanyID,
		})
		if err != nil {
			log.Printf("Failed to get manager task stats: %v", err)
			respondError(w, http.StatusInternalServerError, "Failed to get task stats")
			return
		}

	case "support":
		// Support gets stats filtered by company_id parameter
		companyIDStr := r.URL.Query().Get("company_id")
		if companyIDStr == "" {
			respondError(w, http.StatusBadRequest, "Support role must provide company_id parameter")
			return
		}

		companyID, err := strconv.ParseInt(companyIDStr, 10, 32)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid company_id parameter")
			return
		}

		stats, err = h.queries.GetTaskStatsByCompany(r.Context(), int32(companyID))
		if err != nil {
			log.Printf("Failed to get support task stats: %v", err)
			respondError(w, http.StatusInternalServerError, "Failed to get task stats")
			return
		}

	case "agent":
		// Agent gets their own stats (existing query)
		agentStats, err := h.queries.GetTaskStats(r.Context(), user.ID)
		if err != nil {
			log.Printf("Failed to get agent task stats: %v", err)
			respondError(w, http.StatusInternalServerError, "Failed to get task stats")
			return
		}

		// Get outstanding tasks count
		outstandingCount, err := h.queries.GetOutstandingTasksCount(r.Context(), user.ID)
		if err != nil {
			log.Printf("Failed to get outstanding tasks count: %v", err)
			respondError(w, http.StatusInternalServerError, "Failed to get outstanding tasks count")
			return
		}

		// Combine stats for agent response
		stats = map[string]interface{}{
			"total_tasks":       agentStats.TotalTasks,
			"pending_tasks":     agentStats.PendingTasks,
			"in_progress_tasks": agentStats.InProgressTasks,
			"completed_tasks":   agentStats.CompletedTasks,
			"follow_up_tasks":   agentStats.FollowUpTasks,
			"callback_tasks":    agentStats.CallbackTasks,
			"overdue_tasks":     agentStats.OverdueTasks,
			"outstanding_tasks": outstandingCount,
		}

	default:
		respondError(w, http.StatusForbidden, "Unknown role")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"stats":   stats,
	})
}

// GET /api/stats/calls - Role-based call statistics
func (h *StatsHandler) GetCallStats(w http.ResponseWriter, r *http.Request) {
	// Extract authenticated user from session cookie
	cookie, err := r.Cookie("session_id")
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	session, err := h.queries.GetSession(r.Context(), cookie.Value)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Session expired")
		return
	}

	// Check if session is expired
	if time.Now().After(session.ExpiresAt) {
		h.queries.DeleteSession(r.Context(), session.ID)
		respondError(w, http.StatusUnauthorized, "Session expired")
		return
	}

	user, err := h.queries.GetUserByID(r.Context(), session.UserID)
	if err != nil {
		respondError(w, http.StatusNotFound, "User not found")
		return
	}

	// Route to appropriate query based on role
	var stats interface{}
	switch user.Role {
	case "admin":
		// Admin gets stats for all calls in their company
		stats, err = h.queries.GetCallStatsByCompany(r.Context(), user.CompanyID)
		if err != nil {
			log.Printf("Failed to get admin call stats: %v", err)
			respondError(w, http.StatusInternalServerError, "Failed to get call stats")
			return
		}

	case "manager", "supervisor":
		// Manager gets stats for their subordinates' calls
		stats, err = h.queries.GetCallStatsByManager(r.Context(), db.GetCallStatsByManagerParams{
			ReportsTo: sql.NullInt32{Int32: user.ID, Valid: true},
			CompanyID: user.CompanyID,
		})
		if err != nil {
			log.Printf("Failed to get manager call stats: %v", err)
			respondError(w, http.StatusInternalServerError, "Failed to get call stats")
			return
		}

	case "support":
		// Support gets stats filtered by company_id parameter
		companyIDStr := r.URL.Query().Get("company_id")
		if companyIDStr == "" {
			respondError(w, http.StatusBadRequest, "Support role must provide company_id parameter")
			return
		}

		companyID, err := strconv.ParseInt(companyIDStr, 10, 32)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid company_id parameter")
			return
		}

		stats, err = h.queries.GetCallStatsByCompany(r.Context(), int32(companyID))
		if err != nil {
			log.Printf("Failed to get support call stats: %v", err)
			respondError(w, http.StatusInternalServerError, "Failed to get call stats")
			return
		}

	case "agent":
		// Agent gets their own call stats (existing query)
		agentStats, err := h.queries.GetTodayCallStats(r.Context(), sql.NullInt32{
			Int32: user.ID,
			Valid: true,
		})
		if err != nil {
			log.Printf("Failed to get agent call stats: %v", err)
			respondError(w, http.StatusInternalServerError, "Failed to get call stats")
			return
		}

		// Convert AvgDuration from interface{} to float64
		var avgDuration float64
		if agentStats.AvgDuration != nil {
			switch v := agentStats.AvgDuration.(type) {
			case float64:
				avgDuration = v
			case int64:
				avgDuration = float64(v)
			case []uint8: // MySQL DECIMAL can come as []byte
				fmt.Sscanf(string(v), "%f", &avgDuration)
			default:
				avgDuration = 0
			}
		}

		stats = map[string]interface{}{
			"total_calls":    agentStats.TotalCalls,
			"answered_calls": agentStats.AnsweredCalls,
			"missed_calls":   agentStats.MissedCalls,
			"avg_duration":   avgDuration,
		}

	default:
		respondError(w, http.StatusForbidden, "Unknown role")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"stats":   stats,
	})
}

func respondError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error":   message,
	})
}
