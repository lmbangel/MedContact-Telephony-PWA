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

// GET /api/stats/agents?filter_type=today|yesterday|this_week|this_month|custom&start_date=2026-02-01&end_date=2026-02-07
func (h *StatsHandler) GetAgentBreakdown(w http.ResponseWriter, r *http.Request) {
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
	var breakdown []AgentBreakdown
	switch user.Role {
	case "admin":
		breakdown, err = h.getAgentBreakdownForCompany(r, user.CompanyID, filterType)
	case "manager", "supervisor":
		breakdown, err = h.getAgentBreakdownForManager(r, user.ID, user.CompanyID, filterType)
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
		breakdown, err = h.getAgentBreakdownForCompany(r, int32(companyID), filterType)
	case "agent":
		// Agents cannot see per-agent breakdown
		breakdown = []AgentBreakdown{}
	default:
		respondError(w, http.StatusForbidden, "Unknown role")
		return
	}

	if err != nil {
		log.Printf("Failed to get agent breakdown: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to retrieve agent breakdown")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"agents":  breakdown,
	})
}

// AgentBreakdown combines call and task metrics for a single agent
type AgentBreakdown struct {
	AgentID         int32   `json:"agent_id"`
	Firstname       string  `json:"firstname"`
	Lastname        string  `json:"lastname"`
	AgentIdentifier string  `json:"agent_identifier"`
	TotalCalls      int64   `json:"total_calls"`
	AnsweredCalls   int64   `json:"answered_calls"`
	MissedCalls     int64   `json:"missed_calls"`
	AvgDuration     float64 `json:"avg_duration"`
	TotalTasks      int64   `json:"total_tasks"`
	PendingTasks    int64   `json:"pending_tasks"`
	InProgressTasks int64   `json:"in_progress_tasks"`
	CompletedTasks  int64   `json:"completed_tasks"`
}

// Helper to route by filter type for company-level agent breakdown
func (h *StatsHandler) getAgentBreakdownForCompany(r *http.Request, companyID int32, filterType string) ([]AgentBreakdown, error) {
	ctx := r.Context()

	var callStats interface{}
	var taskStats interface{}
	var err error

	switch filterType {
	case "today":
		callStats, err = h.queries.GetCallStatsByAgentForCompanyToday(ctx, companyID)
		if err != nil {
			return nil, err
		}
		taskStats, err = h.queries.GetTaskStatsByAgentForCompanyToday(ctx, companyID)
	case "yesterday":
		callStats, err = h.queries.GetCallStatsByAgentForCompanyYesterday(ctx, companyID)
		if err != nil {
			return nil, err
		}
		taskStats, err = h.queries.GetTaskStatsByAgentForCompanyYesterday(ctx, companyID)
	case "this_week":
		callStats, err = h.queries.GetCallStatsByAgentForCompanyThisWeek(ctx, companyID)
		if err != nil {
			return nil, err
		}
		taskStats, err = h.queries.GetTaskStatsByAgentForCompanyThisWeek(ctx, companyID)
	case "this_month":
		callStats, err = h.queries.GetCallStatsByAgentForCompanyThisMonth(ctx, companyID)
		if err != nil {
			return nil, err
		}
		taskStats, err = h.queries.GetTaskStatsByAgentForCompanyThisMonth(ctx, companyID)
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

		callStats, err = h.queries.GetCallStatsByAgentForCompanyRange(ctx, db.GetCallStatsByAgentForCompanyRangeParams{
			CreatedAt:   sql.NullTime{Time: startTime, Valid: true},
			CreatedAt_2: sql.NullTime{Time: endTime, Valid: true},
			CompanyID:   companyID,
		})
		if err != nil {
			return nil, err
		}
		taskStats, err = h.queries.GetTaskStatsByAgentForCompanyRange(ctx, db.GetTaskStatsByAgentForCompanyRangeParams{
			CreatedAt:   sql.NullTime{Time: startTime, Valid: true},
			CreatedAt_2: sql.NullTime{Time: endTime, Valid: true},
			CompanyID:   companyID,
		})
	default:
		return nil, fmt.Errorf("unknown filter type: %s", filterType)
	}

	if err != nil {
		return nil, err
	}

	return mergeAgentStats(callStats, taskStats), nil
}

// Helper to route by filter type for manager-level agent breakdown
func (h *StatsHandler) getAgentBreakdownForManager(r *http.Request, managerID, companyID int32, filterType string) ([]AgentBreakdown, error) {
	ctx := r.Context()

	var callStats interface{}
	var taskStats interface{}
	var err error

	switch filterType {
	case "today":
		callStats, err = h.queries.GetCallStatsByAgentForManagerToday(ctx, db.GetCallStatsByAgentForManagerTodayParams{
			ReportsTo:   sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID:   companyID,
			CompanyID_2: companyID,
		})
		if err != nil {
			return nil, err
		}
		taskStats, err = h.queries.GetTaskStatsByAgentForManagerToday(ctx, db.GetTaskStatsByAgentForManagerTodayParams{
			ReportsTo:   sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID:   companyID,
			CompanyID_2: companyID,
		})
	case "yesterday":
		callStats, err = h.queries.GetCallStatsByAgentForManagerYesterday(ctx, db.GetCallStatsByAgentForManagerYesterdayParams{
			ReportsTo:   sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID:   companyID,
			CompanyID_2: companyID,
		})
		if err != nil {
			return nil, err
		}
		taskStats, err = h.queries.GetTaskStatsByAgentForManagerYesterday(ctx, db.GetTaskStatsByAgentForManagerYesterdayParams{
			ReportsTo:   sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID:   companyID,
			CompanyID_2: companyID,
		})
	case "this_week":
		callStats, err = h.queries.GetCallStatsByAgentForManagerThisWeek(ctx, db.GetCallStatsByAgentForManagerThisWeekParams{
			ReportsTo:   sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID:   companyID,
			CompanyID_2: companyID,
		})
		if err != nil {
			return nil, err
		}
		taskStats, err = h.queries.GetTaskStatsByAgentForManagerThisWeek(ctx, db.GetTaskStatsByAgentForManagerThisWeekParams{
			ReportsTo:   sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID:   companyID,
			CompanyID_2: companyID,
		})
	case "this_month":
		callStats, err = h.queries.GetCallStatsByAgentForManagerThisMonth(ctx, db.GetCallStatsByAgentForManagerThisMonthParams{
			ReportsTo:   sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID:   companyID,
			CompanyID_2: companyID,
		})
		if err != nil {
			return nil, err
		}
		taskStats, err = h.queries.GetTaskStatsByAgentForManagerThisMonth(ctx, db.GetTaskStatsByAgentForManagerThisMonthParams{
			ReportsTo:   sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID:   companyID,
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

		callStats, err = h.queries.GetCallStatsByAgentForManagerRange(ctx, db.GetCallStatsByAgentForManagerRangeParams{
			ReportsTo:   sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID:   companyID,
			CompanyID_2: companyID,
			CreatedAt:   sql.NullTime{Time: startTime, Valid: true},
			CreatedAt_2: sql.NullTime{Time: endTime, Valid: true},
		})
		if err != nil {
			return nil, err
		}
		taskStats, err = h.queries.GetTaskStatsByAgentForManagerRange(ctx, db.GetTaskStatsByAgentForManagerRangeParams{
			ReportsTo:   sql.NullInt32{Int32: managerID, Valid: true},
			CompanyID:   companyID,
			CompanyID_2: companyID,
			CreatedAt:   sql.NullTime{Time: startTime, Valid: true},
			CreatedAt_2: sql.NullTime{Time: endTime, Valid: true},
		})
	default:
		return nil, fmt.Errorf("unknown filter type: %s", filterType)
	}

	if err != nil {
		return nil, err
	}

	return mergeAgentStats(callStats, taskStats), nil
}

// mergeAgentStats combines call and task stats by agent_id
func mergeAgentStats(callStats interface{}, taskStats interface{}) []AgentBreakdown {
	// Create map to merge by agent_id
	breakdown := make(map[int32]*AgentBreakdown)

	// Process call stats (handle all time filter row types)
	switch calls := callStats.(type) {
	case []db.GetCallStatsByAgentForCompanyTodayRow:
		for _, c := range calls {
			breakdown[c.AgentID] = &AgentBreakdown{
				AgentID:         c.AgentID,
				Firstname:       c.Firstname,
				Lastname:        c.Lastname,
				AgentIdentifier: c.AgentIdentifier,
				TotalCalls:      c.TotalCalls,
				AnsweredCalls:   c.AnsweredCalls,
				MissedCalls:     c.MissedCalls,
				AvgDuration:     convertAvgDuration(c.AvgDuration),
			}
		}
	case []db.GetCallStatsByAgentForCompanyYesterdayRow:
		for _, c := range calls {
			breakdown[c.AgentID] = &AgentBreakdown{
				AgentID:         c.AgentID,
				Firstname:       c.Firstname,
				Lastname:        c.Lastname,
				AgentIdentifier: c.AgentIdentifier,
				TotalCalls:      c.TotalCalls,
				AnsweredCalls:   c.AnsweredCalls,
				MissedCalls:     c.MissedCalls,
				AvgDuration:     convertAvgDuration(c.AvgDuration),
			}
		}
	case []db.GetCallStatsByAgentForCompanyThisWeekRow:
		for _, c := range calls {
			breakdown[c.AgentID] = &AgentBreakdown{
				AgentID:         c.AgentID,
				Firstname:       c.Firstname,
				Lastname:        c.Lastname,
				AgentIdentifier: c.AgentIdentifier,
				TotalCalls:      c.TotalCalls,
				AnsweredCalls:   c.AnsweredCalls,
				MissedCalls:     c.MissedCalls,
				AvgDuration:     convertAvgDuration(c.AvgDuration),
			}
		}
	case []db.GetCallStatsByAgentForCompanyThisMonthRow:
		for _, c := range calls {
			breakdown[c.AgentID] = &AgentBreakdown{
				AgentID:         c.AgentID,
				Firstname:       c.Firstname,
				Lastname:        c.Lastname,
				AgentIdentifier: c.AgentIdentifier,
				TotalCalls:      c.TotalCalls,
				AnsweredCalls:   c.AnsweredCalls,
				MissedCalls:     c.MissedCalls,
				AvgDuration:     convertAvgDuration(c.AvgDuration),
			}
		}
	case []db.GetCallStatsByAgentForCompanyRangeRow:
		for _, c := range calls {
			breakdown[c.AgentID] = &AgentBreakdown{
				AgentID:         c.AgentID,
				Firstname:       c.Firstname,
				Lastname:        c.Lastname,
				AgentIdentifier: c.AgentIdentifier,
				TotalCalls:      c.TotalCalls,
				AnsweredCalls:   c.AnsweredCalls,
				MissedCalls:     c.MissedCalls,
				AvgDuration:     convertAvgDuration(c.AvgDuration),
			}
		}
	case []db.GetCallStatsByAgentForManagerTodayRow:
		for _, c := range calls {
			breakdown[c.AgentID] = &AgentBreakdown{
				AgentID:         c.AgentID,
				Firstname:       c.Firstname,
				Lastname:        c.Lastname,
				AgentIdentifier: c.AgentIdentifier,
				TotalCalls:      c.TotalCalls,
				AnsweredCalls:   c.AnsweredCalls,
				MissedCalls:     c.MissedCalls,
				AvgDuration:     convertAvgDuration(c.AvgDuration),
			}
		}
	case []db.GetCallStatsByAgentForManagerYesterdayRow:
		for _, c := range calls {
			breakdown[c.AgentID] = &AgentBreakdown{
				AgentID:         c.AgentID,
				Firstname:       c.Firstname,
				Lastname:        c.Lastname,
				AgentIdentifier: c.AgentIdentifier,
				TotalCalls:      c.TotalCalls,
				AnsweredCalls:   c.AnsweredCalls,
				MissedCalls:     c.MissedCalls,
				AvgDuration:     convertAvgDuration(c.AvgDuration),
			}
		}
	case []db.GetCallStatsByAgentForManagerThisWeekRow:
		for _, c := range calls {
			breakdown[c.AgentID] = &AgentBreakdown{
				AgentID:         c.AgentID,
				Firstname:       c.Firstname,
				Lastname:        c.Lastname,
				AgentIdentifier: c.AgentIdentifier,
				TotalCalls:      c.TotalCalls,
				AnsweredCalls:   c.AnsweredCalls,
				MissedCalls:     c.MissedCalls,
				AvgDuration:     convertAvgDuration(c.AvgDuration),
			}
		}
	case []db.GetCallStatsByAgentForManagerThisMonthRow:
		for _, c := range calls {
			breakdown[c.AgentID] = &AgentBreakdown{
				AgentID:         c.AgentID,
				Firstname:       c.Firstname,
				Lastname:        c.Lastname,
				AgentIdentifier: c.AgentIdentifier,
				TotalCalls:      c.TotalCalls,
				AnsweredCalls:   c.AnsweredCalls,
				MissedCalls:     c.MissedCalls,
				AvgDuration:     convertAvgDuration(c.AvgDuration),
			}
		}
	case []db.GetCallStatsByAgentForManagerRangeRow:
		for _, c := range calls {
			breakdown[c.AgentID] = &AgentBreakdown{
				AgentID:         c.AgentID,
				Firstname:       c.Firstname,
				Lastname:        c.Lastname,
				AgentIdentifier: c.AgentIdentifier,
				TotalCalls:      c.TotalCalls,
				AnsweredCalls:   c.AnsweredCalls,
				MissedCalls:     c.MissedCalls,
				AvgDuration:     convertAvgDuration(c.AvgDuration),
			}
		}
	}

	// Process task stats and merge with existing breakdown
	switch tasks := taskStats.(type) {
	case []db.GetTaskStatsByAgentForCompanyTodayRow:
		for _, t := range tasks {
			if agent, exists := breakdown[t.AgentID]; exists {
				agent.TotalTasks = t.TotalTasks
				agent.PendingTasks = t.PendingTasks
				agent.InProgressTasks = t.InProgressTasks
				agent.CompletedTasks = t.CompletedTasks
			} else {
				breakdown[t.AgentID] = &AgentBreakdown{
					AgentID:         t.AgentID,
					Firstname:       t.Firstname,
					Lastname:        t.Lastname,
					AgentIdentifier: t.AgentIdentifier,
					TotalTasks:      t.TotalTasks,
					PendingTasks:    t.PendingTasks,
					InProgressTasks: t.InProgressTasks,
					CompletedTasks:  t.CompletedTasks,
				}
			}
		}
	case []db.GetTaskStatsByAgentForCompanyYesterdayRow:
		for _, t := range tasks {
			if agent, exists := breakdown[t.AgentID]; exists {
				agent.TotalTasks = t.TotalTasks
				agent.PendingTasks = t.PendingTasks
				agent.InProgressTasks = t.InProgressTasks
				agent.CompletedTasks = t.CompletedTasks
			} else {
				breakdown[t.AgentID] = &AgentBreakdown{
					AgentID:         t.AgentID,
					Firstname:       t.Firstname,
					Lastname:        t.Lastname,
					AgentIdentifier: t.AgentIdentifier,
					TotalTasks:      t.TotalTasks,
					PendingTasks:    t.PendingTasks,
					InProgressTasks: t.InProgressTasks,
					CompletedTasks:  t.CompletedTasks,
				}
			}
		}
	case []db.GetTaskStatsByAgentForCompanyThisWeekRow:
		for _, t := range tasks {
			if agent, exists := breakdown[t.AgentID]; exists {
				agent.TotalTasks = t.TotalTasks
				agent.PendingTasks = t.PendingTasks
				agent.InProgressTasks = t.InProgressTasks
				agent.CompletedTasks = t.CompletedTasks
			} else {
				breakdown[t.AgentID] = &AgentBreakdown{
					AgentID:         t.AgentID,
					Firstname:       t.Firstname,
					Lastname:        t.Lastname,
					AgentIdentifier: t.AgentIdentifier,
					TotalTasks:      t.TotalTasks,
					PendingTasks:    t.PendingTasks,
					InProgressTasks: t.InProgressTasks,
					CompletedTasks:  t.CompletedTasks,
				}
			}
		}
	case []db.GetTaskStatsByAgentForCompanyThisMonthRow:
		for _, t := range tasks {
			if agent, exists := breakdown[t.AgentID]; exists {
				agent.TotalTasks = t.TotalTasks
				agent.PendingTasks = t.PendingTasks
				agent.InProgressTasks = t.InProgressTasks
				agent.CompletedTasks = t.CompletedTasks
			} else {
				breakdown[t.AgentID] = &AgentBreakdown{
					AgentID:         t.AgentID,
					Firstname:       t.Firstname,
					Lastname:        t.Lastname,
					AgentIdentifier: t.AgentIdentifier,
					TotalTasks:      t.TotalTasks,
					PendingTasks:    t.PendingTasks,
					InProgressTasks: t.InProgressTasks,
					CompletedTasks:  t.CompletedTasks,
				}
			}
		}
	case []db.GetTaskStatsByAgentForCompanyRangeRow:
		for _, t := range tasks {
			if agent, exists := breakdown[t.AgentID]; exists {
				agent.TotalTasks = t.TotalTasks
				agent.PendingTasks = t.PendingTasks
				agent.InProgressTasks = t.InProgressTasks
				agent.CompletedTasks = t.CompletedTasks
			} else {
				breakdown[t.AgentID] = &AgentBreakdown{
					AgentID:         t.AgentID,
					Firstname:       t.Firstname,
					Lastname:        t.Lastname,
					AgentIdentifier: t.AgentIdentifier,
					TotalTasks:      t.TotalTasks,
					PendingTasks:    t.PendingTasks,
					InProgressTasks: t.InProgressTasks,
					CompletedTasks:  t.CompletedTasks,
				}
			}
		}
	case []db.GetTaskStatsByAgentForManagerTodayRow:
		for _, t := range tasks {
			if agent, exists := breakdown[t.AgentID]; exists {
				agent.TotalTasks = t.TotalTasks
				agent.PendingTasks = t.PendingTasks
				agent.InProgressTasks = t.InProgressTasks
				agent.CompletedTasks = t.CompletedTasks
			} else {
				breakdown[t.AgentID] = &AgentBreakdown{
					AgentID:         t.AgentID,
					Firstname:       t.Firstname,
					Lastname:        t.Lastname,
					AgentIdentifier: t.AgentIdentifier,
					TotalTasks:      t.TotalTasks,
					PendingTasks:    t.PendingTasks,
					InProgressTasks: t.InProgressTasks,
					CompletedTasks:  t.CompletedTasks,
				}
			}
		}
	case []db.GetTaskStatsByAgentForManagerYesterdayRow:
		for _, t := range tasks {
			if agent, exists := breakdown[t.AgentID]; exists {
				agent.TotalTasks = t.TotalTasks
				agent.PendingTasks = t.PendingTasks
				agent.InProgressTasks = t.InProgressTasks
				agent.CompletedTasks = t.CompletedTasks
			} else {
				breakdown[t.AgentID] = &AgentBreakdown{
					AgentID:         t.AgentID,
					Firstname:       t.Firstname,
					Lastname:        t.Lastname,
					AgentIdentifier: t.AgentIdentifier,
					TotalTasks:      t.TotalTasks,
					PendingTasks:    t.PendingTasks,
					InProgressTasks: t.InProgressTasks,
					CompletedTasks:  t.CompletedTasks,
				}
			}
		}
	case []db.GetTaskStatsByAgentForManagerThisWeekRow:
		for _, t := range tasks {
			if agent, exists := breakdown[t.AgentID]; exists {
				agent.TotalTasks = t.TotalTasks
				agent.PendingTasks = t.PendingTasks
				agent.InProgressTasks = t.InProgressTasks
				agent.CompletedTasks = t.CompletedTasks
			} else {
				breakdown[t.AgentID] = &AgentBreakdown{
					AgentID:         t.AgentID,
					Firstname:       t.Firstname,
					Lastname:        t.Lastname,
					AgentIdentifier: t.AgentIdentifier,
					TotalTasks:      t.TotalTasks,
					PendingTasks:    t.PendingTasks,
					InProgressTasks: t.InProgressTasks,
					CompletedTasks:  t.CompletedTasks,
				}
			}
		}
	case []db.GetTaskStatsByAgentForManagerThisMonthRow:
		for _, t := range tasks {
			if agent, exists := breakdown[t.AgentID]; exists {
				agent.TotalTasks = t.TotalTasks
				agent.PendingTasks = t.PendingTasks
				agent.InProgressTasks = t.InProgressTasks
				agent.CompletedTasks = t.CompletedTasks
			} else {
				breakdown[t.AgentID] = &AgentBreakdown{
					AgentID:         t.AgentID,
					Firstname:       t.Firstname,
					Lastname:        t.Lastname,
					AgentIdentifier: t.AgentIdentifier,
					TotalTasks:      t.TotalTasks,
					PendingTasks:    t.PendingTasks,
					InProgressTasks: t.InProgressTasks,
					CompletedTasks:  t.CompletedTasks,
				}
			}
		}
	case []db.GetTaskStatsByAgentForManagerRangeRow:
		for _, t := range tasks {
			if agent, exists := breakdown[t.AgentID]; exists {
				agent.TotalTasks = t.TotalTasks
				agent.PendingTasks = t.PendingTasks
				agent.InProgressTasks = t.InProgressTasks
				agent.CompletedTasks = t.CompletedTasks
			} else {
				breakdown[t.AgentID] = &AgentBreakdown{
					AgentID:         t.AgentID,
					Firstname:       t.Firstname,
					Lastname:        t.Lastname,
					AgentIdentifier: t.AgentIdentifier,
					TotalTasks:      t.TotalTasks,
					PendingTasks:    t.PendingTasks,
					InProgressTasks: t.InProgressTasks,
					CompletedTasks:  t.CompletedTasks,
				}
			}
		}
	}

	// Convert map to slice
	result := make([]AgentBreakdown, 0, len(breakdown))
	for _, agent := range breakdown {
		result = append(result, *agent)
	}

	return result
}

// convertAvgDuration converts interface{} to float64
func convertAvgDuration(val interface{}) float64 {
	if val == nil {
		return 0
	}
	switch v := val.(type) {
	case float64:
		return v
	case int64:
		return float64(v)
	case []uint8:
		var f float64
		fmt.Sscanf(string(v), "%f", &f)
		return f
	default:
		return 0
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
