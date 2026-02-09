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

// GET /api/stats/tasks?filter_type=today|yesterday|this_week|this_month|custom&start_date=2026-02-01&end_date=2026-02-07
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

	// Parse filter type parameter (default: today)
	filterType := r.URL.Query().Get("filter_type")
	if filterType == "" {
		filterType = "today"
	}

	// Route to appropriate query based on role AND filter type
	var stats interface{}
	switch user.Role {
	case "admin":
		stats, err = h.getTaskStatsForCompany(r, user.CompanyID, filterType)
	case "manager", "supervisor":
		stats, err = h.getTaskStatsForManager(r, user.ID, user.CompanyID, filterType)
	case "support":
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
		stats, err = h.getTaskStatsForCompany(r, int32(companyID), filterType)
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

	if err != nil {
		log.Printf("Failed to get task stats: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to retrieve task statistics")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"stats":   stats,
	})
}

// Helper to route by filter type for company-level task stats
func (h *StatsHandler) getTaskStatsForCompany(r *http.Request, companyID int32, filterType string) (interface{}, error) {
	ctx := r.Context()

	switch filterType {
	case "today":
		return h.queries.GetTaskStatsByCompanyToday(ctx, companyID)
	case "yesterday":
		return h.queries.GetTaskStatsByCompanyYesterday(ctx, companyID)
	case "this_week":
		return h.queries.GetTaskStatsByCompanyThisWeek(ctx, companyID)
	case "this_month":
		return h.queries.GetTaskStatsByCompanyThisMonth(ctx, companyID)
	case "custom":
		startStr := r.URL.Query().Get("start_date")
		endStr := r.URL.Query().Get("end_date")

		if startStr == "" || endStr == "" {
			return nil, fmt.Errorf("custom filter requires start_date and end_date parameters")
		}

		// Parse ISO 8601 dates (YYYY-MM-DD format)
		startTime, err := time.Parse("2006-01-02", startStr)
		if err != nil {
			return nil, fmt.Errorf("invalid start_date format (use YYYY-MM-DD)")
		}

		endTime, err := time.Parse("2006-01-02", endStr)
		if err != nil {
			return nil, fmt.Errorf("invalid end_date format (use YYYY-MM-DD)")
		}

		// Validate range logic
		if startTime.After(endTime) {
			return nil, fmt.Errorf("start_date must be before or equal to end_date")
		}

		// Adjust end time to include entire end date (add 1 day)
		endTime = endTime.AddDate(0, 0, 1)

		return h.queries.GetTaskStatsByCompanyRange(ctx, db.GetTaskStatsByCompanyRangeParams{
			CompanyID: companyID,
			CreatedAt: sql.NullTime{Time: startTime, Valid: true},
			CreatedAt_2: sql.NullTime{Time: endTime, Valid: true},
		})
	default:
		return nil, fmt.Errorf("unknown filter type: %s", filterType)
	}
}

// Helper to route by filter type for manager-level task stats
func (h *StatsHandler) getTaskStatsForManager(r *http.Request, managerID, companyID int32, filterType string) (interface{}, error) {
	ctx := r.Context()

	switch filterType {
	case "today":
		return h.queries.GetTaskStatsByManagerToday(ctx, db.GetTaskStatsByManagerTodayParams{
			ReportsTo: sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID: companyID,
			CompanyID_2: companyID,
		})
	case "yesterday":
		return h.queries.GetTaskStatsByManagerYesterday(ctx, db.GetTaskStatsByManagerYesterdayParams{
			ReportsTo: sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID: companyID,
			CompanyID_2: companyID,
		})
	case "this_week":
		return h.queries.GetTaskStatsByManagerThisWeek(ctx, db.GetTaskStatsByManagerThisWeekParams{
			ReportsTo: sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID: companyID,
			CompanyID_2: companyID,
		})
	case "this_month":
		return h.queries.GetTaskStatsByManagerThisMonth(ctx, db.GetTaskStatsByManagerThisMonthParams{
			ReportsTo: sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID: companyID,
			CompanyID_2: companyID,
		})
	case "custom":
		startStr := r.URL.Query().Get("start_date")
		endStr := r.URL.Query().Get("end_date")

		if startStr == "" || endStr == "" {
			return nil, fmt.Errorf("custom filter requires start_date and end_date parameters")
		}

		startTime, err := time.Parse("2006-01-02", startStr)
		if err != nil {
			return nil, fmt.Errorf("invalid start_date format (use YYYY-MM-DD)")
		}

		endTime, err := time.Parse("2006-01-02", endStr)
		if err != nil {
			return nil, fmt.Errorf("invalid end_date format (use YYYY-MM-DD)")
		}

		if startTime.After(endTime) {
			return nil, fmt.Errorf("start_date must be before or equal to end_date")
		}

		endTime = endTime.AddDate(0, 0, 1)

		return h.queries.GetTaskStatsByManagerRange(ctx, db.GetTaskStatsByManagerRangeParams{
			ReportsTo: sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID: companyID,
			CompanyID_2: companyID,
			CreatedAt: sql.NullTime{Time: startTime, Valid: true},
			CreatedAt_2: sql.NullTime{Time: endTime, Valid: true},
		})
	default:
		return nil, fmt.Errorf("unknown filter type: %s", filterType)
	}
}

// GET /api/stats/calls?filter_type=today|yesterday|this_week|this_month|custom&start_date=2026-02-01&end_date=2026-02-07
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

	// Parse filter type parameter (default: today)
	filterType := r.URL.Query().Get("filter_type")
	if filterType == "" {
		filterType = "today"
	}

	// Route to appropriate query based on role AND filter type
	var stats interface{}
	switch user.Role {
	case "admin":
		stats, err = h.getCallStatsForCompany(r, user.CompanyID, filterType)
	case "manager", "supervisor":
		stats, err = h.getCallStatsForManager(r, user.ID, user.CompanyID, filterType)
	case "support":
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
		stats, err = h.getCallStatsForCompany(r, int32(companyID), filterType)
	case "agent":
		// Agent gets their own stats (existing single-agent query)
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
			case []uint8:
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

	if err != nil {
		log.Printf("Failed to get call stats: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to retrieve call statistics")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"stats":   stats,
	})
}

// Helper to route by filter type for company-level call stats
func (h *StatsHandler) getCallStatsForCompany(r *http.Request, companyID int32, filterType string) (interface{}, error) {
	ctx := r.Context()

	switch filterType {
	case "today":
		return h.queries.GetCallStatsByCompanyToday(ctx, companyID)
	case "yesterday":
		return h.queries.GetCallStatsByCompanyYesterday(ctx, companyID)
	case "this_week":
		return h.queries.GetCallStatsByCompanyThisWeek(ctx, companyID)
	case "this_month":
		return h.queries.GetCallStatsByCompanyThisMonth(ctx, companyID)
	case "custom":
		startStr := r.URL.Query().Get("start_date")
		endStr := r.URL.Query().Get("end_date")

		if startStr == "" || endStr == "" {
			return nil, fmt.Errorf("custom filter requires start_date and end_date parameters")
		}

		// Parse ISO 8601 dates (YYYY-MM-DD format)
		startTime, err := time.Parse("2006-01-02", startStr)
		if err != nil {
			return nil, fmt.Errorf("invalid start_date format (use YYYY-MM-DD)")
		}

		endTime, err := time.Parse("2006-01-02", endStr)
		if err != nil {
			return nil, fmt.Errorf("invalid end_date format (use YYYY-MM-DD)")
		}

		// Validate range logic
		if startTime.After(endTime) {
			return nil, fmt.Errorf("start_date must be before or equal to end_date")
		}

		// Adjust end time to include entire end date (add 1 day)
		endTime = endTime.AddDate(0, 0, 1)

		return h.queries.GetCallStatsByCompanyRange(ctx, db.GetCallStatsByCompanyRangeParams{
			CompanyID: companyID,
			CreatedAt: sql.NullTime{Time: startTime, Valid: true},
			CreatedAt_2: sql.NullTime{Time: endTime, Valid: true},
		})
	default:
		return nil, fmt.Errorf("unknown filter type: %s", filterType)
	}
}

// Helper to route by filter type for manager-level call stats
func (h *StatsHandler) getCallStatsForManager(r *http.Request, managerID, companyID int32, filterType string) (interface{}, error) {
	ctx := r.Context()

	switch filterType {
	case "today":
		return h.queries.GetCallStatsByManagerToday(ctx, db.GetCallStatsByManagerTodayParams{
			ReportsTo: sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID: companyID,
			CompanyID_2: companyID,
		})
	case "yesterday":
		return h.queries.GetCallStatsByManagerYesterday(ctx, db.GetCallStatsByManagerYesterdayParams{
			ReportsTo: sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID: companyID,
			CompanyID_2: companyID,
		})
	case "this_week":
		return h.queries.GetCallStatsByManagerThisWeek(ctx, db.GetCallStatsByManagerThisWeekParams{
			ReportsTo: sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID: companyID,
			CompanyID_2: companyID,
		})
	case "this_month":
		return h.queries.GetCallStatsByManagerThisMonth(ctx, db.GetCallStatsByManagerThisMonthParams{
			ReportsTo: sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID: companyID,
			CompanyID_2: companyID,
		})
	case "custom":
		startStr := r.URL.Query().Get("start_date")
		endStr := r.URL.Query().Get("end_date")

		if startStr == "" || endStr == "" {
			return nil, fmt.Errorf("custom filter requires start_date and end_date parameters")
		}

		startTime, err := time.Parse("2006-01-02", startStr)
		if err != nil {
			return nil, fmt.Errorf("invalid start_date format (use YYYY-MM-DD)")
		}

		endTime, err := time.Parse("2006-01-02", endStr)
		if err != nil {
			return nil, fmt.Errorf("invalid end_date format (use YYYY-MM-DD)")
		}

		if startTime.After(endTime) {
			return nil, fmt.Errorf("start_date must be before or equal to end_date")
		}

		endTime = endTime.AddDate(0, 0, 1)

		return h.queries.GetCallStatsByManagerRange(ctx, db.GetCallStatsByManagerRangeParams{
			ReportsTo: sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID: companyID,
			CompanyID_2: companyID,
			CreatedAt: sql.NullTime{Time: startTime, Valid: true},
			CreatedAt_2: sql.NullTime{Time: endTime, Valid: true},
		})
	default:
		return nil, fmt.Errorf("unknown filter type: %s", filterType)
	}
}

// GET /api/stats/activity?filter_type=today|yesterday|this_week|this_month|custom&start_date=2026-02-01&end_date=2026-02-07
func (h *StatsHandler) GetActivityStats(w http.ResponseWriter, r *http.Request) {
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

	// Parse filter type parameter (default: today)
	filterType := r.URL.Query().Get("filter_type")
	if filterType == "" {
		filterType = "today"
	}

	// Activity stats are per-user only (all roles see their own activity)
	stats, err := h.getActivityStatsForAgent(r, user.ID, filterType)
	if err != nil {
		log.Printf("Failed to get activity stats: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to retrieve activity statistics")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"stats":   stats,
	})
}

// Helper to route by filter type for agent-level activity stats
func (h *StatsHandler) getActivityStatsForAgent(r *http.Request, userID int32, filterType string) (interface{}, error) {
	ctx := r.Context()

	switch filterType {
	case "today":
		return h.queries.GetActivityStatsByAgentToday(ctx, userID)
	case "yesterday":
		return h.queries.GetActivityStatsByAgentYesterday(ctx, userID)
	case "this_week":
		return h.queries.GetActivityStatsByAgentThisWeek(ctx, userID)
	case "this_month":
		return h.queries.GetActivityStatsByAgentThisMonth(ctx, userID)
	case "custom":
		startStr := r.URL.Query().Get("start_date")
		endStr := r.URL.Query().Get("end_date")

		if startStr == "" || endStr == "" {
			return nil, fmt.Errorf("custom filter requires start_date and end_date parameters")
		}

		// Parse ISO 8601 dates (YYYY-MM-DD format)
		startTime, err := time.Parse("2006-01-02", startStr)
		if err != nil {
			return nil, fmt.Errorf("invalid start_date format (use YYYY-MM-DD)")
		}

		endTime, err := time.Parse("2006-01-02", endStr)
		if err != nil {
			return nil, fmt.Errorf("invalid end_date format (use YYYY-MM-DD)")
		}

		// Validate range logic
		if startTime.After(endTime) {
			return nil, fmt.Errorf("start_date must be before or equal to end_date")
		}

		// Adjust end time to include entire end date (add 1 day)
		endTime = endTime.AddDate(0, 0, 1)

		return h.queries.GetActivityStatsByAgentRange(ctx, db.GetActivityStatsByAgentRangeParams{
			UserID: userID,
			CreatedAt: sql.NullTime{Time: startTime, Valid: true},
			CreatedAt_2: sql.NullTime{Time: endTime, Valid: true},
		})
	default:
		return nil, fmt.Errorf("unknown filter type: %s", filterType)
	}
}

func respondError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error":   message,
	})
}
