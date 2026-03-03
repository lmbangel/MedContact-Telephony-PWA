-- name: GetCompany :one
SELECT * FROM companies WHERE id = ?;

-- name: GetAllCompanies :many
SELECT * FROM companies ORDER BY created_at DESC;

-- name: CreateCompany :execresult
INSERT INTO companies (name) VALUES (?);

-- name: GetUserByID :one
SELECT * FROM users WHERE id = ?;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = ?;

-- name: GetUserByAgentID :one
SELECT * FROM users WHERE agent_id = ?;

-- name: CreateUser :execresult
INSERT INTO users (email, password_hash, firstname, lastname, agent_id, company_id)
VALUES (?, ?, ?, ?, ?, ?);

-- name: GetSession :one
SELECT * FROM sessions WHERE id = ?;

-- name: CreateSession :execresult
INSERT INTO sessions (id, user_id, expires_at)
VALUES (?, ?, ?);

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = ?;

-- -----------------------
-- Customer Queries
-- -----------------------

-- name: GetCustomerByID :one
SELECT * FROM customers WHERE id = ?;

-- name: GetCustomerByEmail :one
SELECT * FROM customers WHERE email = ?;

-- name: GetCustomerByPhone :one
SELECT * FROM customers WHERE phone = ?;

-- name: GetAllCustomers :many
SELECT * FROM customers ORDER BY created_at DESC;

-- name: GetCustomersByCompany :many
SELECT * FROM customers WHERE company_id = ? ORDER BY first_name ASC, last_name ASC;

-- name: CreateCustomer :execresult
INSERT INTO customers (company_id, first_name, last_name, email, phone, medical_aid_provider, medical_aid_number, medical_plan)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);

-- -----------------------
-- Customer Premium Queries
-- -----------------------

-- name: GetCustomerPremiumsByCustomerID :many
SELECT * FROM customer_premiums WHERE customer_id = ? ORDER BY effective_date DESC;

-- name: CreateCustomerPremium :execresult
INSERT INTO customer_premiums (customer_id, premium_amount, effective_date)
VALUES (?, ?, ?);

-- -----------------------
-- OTP Code Queries
-- -----------------------

-- name: CreateOTPCode :execresult
INSERT INTO otp_codes (email, otp_code, expires_at)
VALUES (?, ?, ?);

-- name: GetValidOTPCode :one
SELECT * FROM otp_codes
WHERE email = ? AND otp_code = ? AND used = 0 AND expires_at > NOW()
ORDER BY created_at DESC LIMIT 1;

-- name: MarkOTPCodeAsUsed :exec
UPDATE otp_codes SET used = 1 WHERE id = ?;

-- name: DeleteExpiredOTPCodes :exec
DELETE FROM otp_codes WHERE expires_at < NOW() OR used = 1;

-- name: CountRecentOTPAttempts :one
SELECT COUNT(*) as count FROM otp_codes
WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE);

-- -----------------------
-- Agent Status Queries
-- -----------------------

-- name: GetLatestAgentStatus :one
SELECT * FROM agent_status
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT 1;

-- name: CreateAgentStatus :execresult
INSERT INTO agent_status (user_id, status)
VALUES (?, ?);

-- -----------------------
-- Call/Transcription Queries
-- -----------------------

-- name: CreateCallRecord :execresult
INSERT INTO transcriptions (
    customer_id, agent_id, company_id, call_sid, from_number,
    to_number, call_status, duration, recording_start_time
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateCallRecord :exec
UPDATE transcriptions
SET call_status = ?, duration = ?
WHERE call_sid = ?;

-- name: GetCallBySid :one
SELECT * FROM transcriptions WHERE call_sid = ?;

-- name: GetTodayCallStats :one
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE agent_id = ?
    AND DATE(created_at) = CURDATE();

-- name: GetAgentCallHistory :many
SELECT * FROM transcriptions
WHERE agent_id = ?
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: GetCallsByCustomer :many
SELECT * FROM transcriptions
WHERE customer_id = ?
ORDER BY created_at DESC
LIMIT 20;

-- name: GetCallsByPhone :many
SELECT * FROM transcriptions
WHERE from_number = ? OR to_number = ?
ORDER BY created_at DESC
LIMIT 20;

-- -----------------------
-- Task Queries
-- -----------------------

-- name: CreateTask :execresult
INSERT INTO tasks (assigned_to, customer_id, call_id, title, description, type, status, due_date)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);

-- name: GetTaskByID :one
SELECT * FROM tasks WHERE id = ?;

-- name: GetTasksByUser :many
SELECT * FROM tasks
WHERE assigned_to = ?
ORDER BY created_at DESC;

-- name: GetPendingTasksByUser :many
SELECT * FROM tasks
WHERE assigned_to = ? AND status = 'pending'
ORDER BY due_date ASC;

-- name: GetTasksByCustomer :many
SELECT * FROM tasks
WHERE customer_id = ?
ORDER BY created_at DESC;

-- name: GetTaskStats :one
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN type = 'follow-up' THEN 1 END) as follow_up_tasks,
    COUNT(CASE WHEN type = 'callback' THEN 1 END) as callback_tasks,
    COUNT(CASE WHEN status != 'completed' AND due_date IS NOT NULL AND due_date < NOW() THEN 1 END) as overdue_tasks
FROM tasks
WHERE assigned_to = ?;

-- name: GetTaskStatsByType :one
SELECT
    COUNT(*) as task_count
FROM tasks
WHERE assigned_to = ? AND type = ?;

-- name: GetTaskStatsByStatus :one
SELECT
    COUNT(*) as task_count
FROM tasks
WHERE assigned_to = ? AND status = ?;

-- name: GetOutstandingTasksCount :one
SELECT
    COUNT(*) as task_count
FROM tasks
WHERE assigned_to = ? AND status != 'completed';

-- name: GetOverdueTasksCount :one
SELECT
    COUNT(*) as task_count
FROM tasks
WHERE assigned_to = ? AND status != 'completed' AND due_date IS NOT NULL AND due_date < NOW();

-- name: GetTasksDueToday :one
SELECT
    COUNT(*) as task_count
FROM tasks
WHERE assigned_to = ? AND DATE(due_date) = CURDATE() AND status != 'completed';

-- name: GetTasksDueInNext7Days :one
SELECT
    COUNT(*) as task_count
FROM tasks
WHERE assigned_to = ?
    AND status != 'completed'
    AND due_date IS NOT NULL
    AND due_date >= NOW()
    AND due_date <= DATE_ADD(NOW(), INTERVAL 7 DAY);

-- -----------------------
-- Sequential Call Routing Queries
-- -----------------------

-- name: GetAvailableAgentsByCompanyLongestIdle :many
SELECT u.id, u.agent_id, u.firstname, u.lastname, u.company_id, u.last_call_ended_at
FROM users u
INNER JOIN (
    SELECT user_id, MAX(created_at) as latest_status_time
    FROM agent_status
    GROUP BY user_id
) latest_status ON u.id = latest_status.user_id
INNER JOIN agent_status ast ON u.id = ast.user_id
    AND ast.created_at = latest_status.latest_status_time
WHERE u.company_id = ?
    AND ast.status = 'available'
ORDER BY COALESCE(u.last_call_ended_at, '1970-01-01 00:00:00') ASC, u.id ASC;

-- name: UpdateUserLastCallEnded :exec
UPDATE users SET last_call_ended_at = ? WHERE id = ?;

-- name: GetAllUsersByCompany :many
SELECT * FROM users WHERE company_id = ? ORDER BY id ASC;

-- name: GetUsersByRole :many
SELECT * FROM users WHERE company_id = ? AND role = ? ORDER BY firstname ASC;

-- name: GetActiveUsersByCompany :many
SELECT * FROM users WHERE company_id = ? AND is_active = 1 ORDER BY firstname ASC;

-- name: GetDirectReports :many
SELECT * FROM users WHERE reports_to = ? ORDER BY firstname ASC;

-- name: UpdateUserRole :exec
UPDATE users SET role = ? WHERE id = ?;

-- name: UpdateUserIsActive :exec
UPDATE users SET is_active = ? WHERE id = ?;

-- name: UpdateUserReportsTo :exec
UPDATE users SET reports_to = ? WHERE id = ?;

-- -----------------------
-- Call Queue Queries
-- -----------------------

-- name: CreateQueueEntry :execresult
INSERT INTO call_queue (call_sid, company_id, from_number, to_number, status, agents_tried)
VALUES (?, ?, ?, ?, 'waiting', '[]');

-- name: GetQueueEntry :one
SELECT * FROM call_queue WHERE call_sid = ?;

-- name: UpdateQueueEntry :exec
UPDATE call_queue
SET status = ?, current_agent_index = ?, agents_tried = ?, updated_at = NOW()
WHERE call_sid = ?;

-- name: UpdateQueueStatus :exec
UPDATE call_queue SET status = ?, updated_at = NOW() WHERE call_sid = ?;

-- name: DeleteQueueEntry :exec
DELETE FROM call_queue WHERE call_sid = ?;

-- name: GetOldestWaitingCall :one
SELECT * FROM call_queue
WHERE company_id = ? AND status = 'waiting'
ORDER BY created_at ASC
LIMIT 1;

-- name: GetWaitingCallsByCompany :many
SELECT * FROM call_queue
WHERE company_id = ? AND status = 'waiting'
ORDER BY created_at ASC;

-- name: MarkQueueEntryRouting :exec
UPDATE call_queue SET status = 'routing', updated_at = NOW() WHERE call_sid = ?;

-- name: MarkQueueEntryConnected :exec
UPDATE call_queue SET status = 'connected', updated_at = NOW() WHERE call_sid = ?;

-- name: MarkQueueEntryAbandoned :exec
UPDATE call_queue SET status = 'abandoned', updated_at = NOW() WHERE call_sid = ?;

-- -----------------------
-- Role-Based Authorization Queries - Admin (Company-Scoped)
-- -----------------------

-- name: GetTasksByCompany :many
SELECT t.* FROM tasks t
JOIN users u ON t.assigned_to = u.id
WHERE u.company_id = ?
ORDER BY t.created_at DESC;

-- name: GetCallsByCompany :many
SELECT * FROM transcriptions
WHERE company_id = ?
ORDER BY created_at DESC;

-- name: GetTaskStatsByCompany :one
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN type = 'follow-up' THEN 1 END) as follow_up_tasks,
    COUNT(CASE WHEN type = 'callback' THEN 1 END) as callback_tasks,
    COUNT(CASE WHEN status != 'completed' AND due_date IS NOT NULL AND due_date < NOW() THEN 1 END) as overdue_tasks
FROM tasks t
JOIN users u ON t.assigned_to = u.id
WHERE u.company_id = ?;

-- name: GetTaskStatsByCompanyToday :one
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN type = 'follow-up' THEN 1 END) as follow_up_tasks,
    COUNT(CASE WHEN type = 'callback' THEN 1 END) as callback_tasks,
    COUNT(CASE WHEN status != 'completed' AND due_date IS NOT NULL AND due_date < NOW() THEN 1 END) as overdue_tasks
FROM tasks t
JOIN users u ON t.assigned_to = u.id
WHERE u.company_id = ? AND DATE(t.created_at) = CURDATE();

-- name: GetTaskStatsByCompanyYesterday :one
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN type = 'follow-up' THEN 1 END) as follow_up_tasks,
    COUNT(CASE WHEN type = 'callback' THEN 1 END) as callback_tasks,
    COUNT(CASE WHEN status != 'completed' AND due_date IS NOT NULL AND due_date < NOW() THEN 1 END) as overdue_tasks
FROM tasks t
JOIN users u ON t.assigned_to = u.id
WHERE u.company_id = ? AND DATE(t.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY);

-- name: GetTaskStatsByCompanyThisWeek :one
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN type = 'follow-up' THEN 1 END) as follow_up_tasks,
    COUNT(CASE WHEN type = 'callback' THEN 1 END) as callback_tasks,
    COUNT(CASE WHEN status != 'completed' AND due_date IS NOT NULL AND due_date < NOW() THEN 1 END) as overdue_tasks
FROM tasks t
JOIN users u ON t.assigned_to = u.id
WHERE u.company_id = ? AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND t.created_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY);

-- name: GetTaskStatsByCompanyThisMonth :one
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN type = 'follow-up' THEN 1 END) as follow_up_tasks,
    COUNT(CASE WHEN type = 'callback' THEN 1 END) as callback_tasks,
    COUNT(CASE WHEN status != 'completed' AND due_date IS NOT NULL AND due_date < NOW() THEN 1 END) as overdue_tasks
FROM tasks t
JOIN users u ON t.assigned_to = u.id
WHERE u.company_id = ? AND YEAR(t.created_at) = YEAR(CURDATE()) AND MONTH(t.created_at) = MONTH(CURDATE());

-- name: GetTaskStatsByCompanyRange :one
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN type = 'follow-up' THEN 1 END) as follow_up_tasks,
    COUNT(CASE WHEN type = 'callback' THEN 1 END) as callback_tasks,
    COUNT(CASE WHEN status != 'completed' AND due_date IS NOT NULL AND due_date < NOW() THEN 1 END) as overdue_tasks
FROM tasks t
JOIN users u ON t.assigned_to = u.id
WHERE u.company_id = ? AND t.created_at >= ? AND t.created_at < ?;

-- name: GetCallStatsByCompany :one
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE company_id = ?;

-- name: GetCallStatsByCompanyToday :one
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE company_id = ? AND DATE(created_at) = CURDATE();

-- name: GetCallStatsByCompanyYesterday :one
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE company_id = ? AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY);

-- name: GetCallStatsByCompanyThisWeek :one
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE company_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND created_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY);

-- name: GetCallStatsByCompanyThisMonth :one
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE company_id = ? AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE());

-- name: GetCallStatsByCompanyRange :one
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE company_id = ? AND created_at >= ? AND created_at < ?;

-- -----------------------
-- Role-Based Authorization Queries - Manager (Hierarchy-Scoped)
-- -----------------------

-- name: GetSubordinatesByManager :many
WITH RECURSIVE subordinates AS (
    SELECT u.id, u.firstname, u.lastname, u.agent_id, u.company_id, u.role, u.reports_to
    FROM users u
    WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id, u.firstname, u.lastname, u.agent_id, u.company_id, u.role, u.reports_to
    FROM users u
    JOIN subordinates s ON u.reports_to = s.id
    WHERE u.is_active = 1
)
SELECT * FROM subordinates
ORDER BY firstname ASC, lastname ASC;

-- name: GetTasksByManager :many
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u
    WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u
    JOIN subordinates s ON u.reports_to = s.id
    WHERE u.is_active = 1
)
SELECT t.* FROM tasks t
WHERE t.assigned_to IN (SELECT id FROM subordinates)
ORDER BY t.created_at DESC;

-- name: GetCallsByManager :many
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u
    WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u
    JOIN subordinates s ON u.reports_to = s.id
    WHERE u.is_active = 1
)
SELECT t.* FROM transcriptions t
WHERE t.agent_id IN (SELECT id FROM subordinates)
ORDER BY t.created_at DESC;

-- name: GetTaskStatsByManager :one
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u
    WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u
    JOIN subordinates s ON u.reports_to = s.id
    WHERE u.is_active = 1
)
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN type = 'follow-up' THEN 1 END) as follow_up_tasks,
    COUNT(CASE WHEN type = 'callback' THEN 1 END) as callback_tasks,
    COUNT(CASE WHEN status != 'completed' AND due_date IS NOT NULL AND due_date < NOW() THEN 1 END) as overdue_tasks
FROM tasks t
WHERE t.assigned_to IN (SELECT id FROM subordinates);

-- name: GetTaskStatsByManagerToday :one
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN type = 'follow-up' THEN 1 END) as follow_up_tasks,
    COUNT(CASE WHEN type = 'callback' THEN 1 END) as callback_tasks,
    COUNT(CASE WHEN status != 'completed' AND due_date IS NOT NULL AND due_date < NOW() THEN 1 END) as overdue_tasks
FROM tasks t
WHERE t.assigned_to IN (SELECT id FROM subordinates) AND DATE(t.created_at) = CURDATE();

-- name: GetTaskStatsByManagerYesterday :one
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN type = 'follow-up' THEN 1 END) as follow_up_tasks,
    COUNT(CASE WHEN type = 'callback' THEN 1 END) as callback_tasks,
    COUNT(CASE WHEN status != 'completed' AND due_date IS NOT NULL AND due_date < NOW() THEN 1 END) as overdue_tasks
FROM tasks t
WHERE t.assigned_to IN (SELECT id FROM subordinates) AND DATE(t.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY);

-- name: GetTaskStatsByManagerThisWeek :one
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN type = 'follow-up' THEN 1 END) as follow_up_tasks,
    COUNT(CASE WHEN type = 'callback' THEN 1 END) as callback_tasks,
    COUNT(CASE WHEN status != 'completed' AND due_date IS NOT NULL AND due_date < NOW() THEN 1 END) as overdue_tasks
FROM tasks t
WHERE t.assigned_to IN (SELECT id FROM subordinates) AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND t.created_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY);

-- name: GetTaskStatsByManagerThisMonth :one
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN type = 'follow-up' THEN 1 END) as follow_up_tasks,
    COUNT(CASE WHEN type = 'callback' THEN 1 END) as callback_tasks,
    COUNT(CASE WHEN status != 'completed' AND due_date IS NOT NULL AND due_date < NOW() THEN 1 END) as overdue_tasks
FROM tasks t
WHERE t.assigned_to IN (SELECT id FROM subordinates) AND YEAR(t.created_at) = YEAR(CURDATE()) AND MONTH(t.created_at) = MONTH(CURDATE());

-- name: GetTaskStatsByManagerRange :one
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN type = 'follow-up' THEN 1 END) as follow_up_tasks,
    COUNT(CASE WHEN type = 'callback' THEN 1 END) as callback_tasks,
    COUNT(CASE WHEN status != 'completed' AND due_date IS NOT NULL AND due_date < NOW() THEN 1 END) as overdue_tasks
FROM tasks t
WHERE t.assigned_to IN (SELECT id FROM subordinates) AND t.created_at >= ? AND t.created_at < ?;

-- name: GetCallStatsByManager :one
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u
    WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u
    JOIN subordinates s ON u.reports_to = s.id
    WHERE u.is_active = 1
)
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE agent_id IN (SELECT id FROM subordinates);

-- name: GetCallStatsByManagerToday :one
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE agent_id IN (SELECT id FROM subordinates) AND DATE(created_at) = CURDATE();

-- name: GetCallStatsByManagerYesterday :one
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE agent_id IN (SELECT id FROM subordinates) AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY);

-- name: GetCallStatsByManagerThisWeek :one
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE agent_id IN (SELECT id FROM subordinates) AND created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND created_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY);

-- name: GetCallStatsByManagerThisMonth :one
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE agent_id IN (SELECT id FROM subordinates) AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE());

-- name: GetCallStatsByManagerRange :one
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    COUNT(*) as total_calls,
    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration
FROM transcriptions
WHERE agent_id IN (SELECT id FROM subordinates) AND transcriptions.created_at >= ? AND transcriptions.created_at < ?;

-- -----------------------
-- Activity Metrics Queries
-- -----------------------

-- name: GetActivityStatsByAgentToday :one
WITH status_events AS (
    SELECT
        user_id,
        status,
        created_at,
        LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) as prev_event_time
    FROM agent_status
    WHERE user_id = ? AND DATE(created_at) = CURDATE()
),
time_blocks AS (
    SELECT
        user_id,
        status,
        TIMESTAMPDIFF(SECOND, prev_event_time, created_at) as duration_seconds
    FROM status_events
    WHERE prev_event_time IS NOT NULL
        AND status IN ('available', 'on-call', 'after-call-work')
)
SELECT
    COALESCE(SUM(duration_seconds) / 3600.0, 0) as hours_online,
    COALESCE(SUM(CASE WHEN status = 'on-call' THEN duration_seconds ELSE 0 END) / 3600.0, 0) as active_call_hours
FROM time_blocks;

-- name: GetActivityStatsByAgentYesterday :one
WITH status_events AS (
    SELECT
        user_id,
        status,
        created_at,
        LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) as prev_event_time
    FROM agent_status
    WHERE user_id = ? AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
),
time_blocks AS (
    SELECT
        user_id,
        status,
        TIMESTAMPDIFF(SECOND, prev_event_time, created_at) as duration_seconds
    FROM status_events
    WHERE prev_event_time IS NOT NULL
        AND status IN ('available', 'on-call', 'after-call-work')
)
SELECT
    COALESCE(SUM(duration_seconds) / 3600.0, 0) as hours_online,
    COALESCE(SUM(CASE WHEN status = 'on-call' THEN duration_seconds ELSE 0 END) / 3600.0, 0) as active_call_hours
FROM time_blocks;

-- name: GetActivityStatsByAgentThisWeek :one
WITH status_events AS (
    SELECT
        user_id,
        status,
        created_at,
        LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) as prev_event_time
    FROM agent_status
    WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND created_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)
),
time_blocks AS (
    SELECT
        user_id,
        status,
        TIMESTAMPDIFF(SECOND, prev_event_time, created_at) as duration_seconds
    FROM status_events
    WHERE prev_event_time IS NOT NULL
        AND status IN ('available', 'on-call', 'after-call-work')
)
SELECT
    COALESCE(SUM(duration_seconds) / 3600.0, 0) as hours_online,
    COALESCE(SUM(CASE WHEN status = 'on-call' THEN duration_seconds ELSE 0 END) / 3600.0, 0) as active_call_hours
FROM time_blocks;

-- name: GetActivityStatsByAgentThisMonth :one
WITH status_events AS (
    SELECT
        user_id,
        status,
        created_at,
        LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) as prev_event_time
    FROM agent_status
    WHERE user_id = ? AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())
),
time_blocks AS (
    SELECT
        user_id,
        status,
        TIMESTAMPDIFF(SECOND, prev_event_time, created_at) as duration_seconds
    FROM status_events
    WHERE prev_event_time IS NOT NULL
        AND status IN ('available', 'on-call', 'after-call-work')
)
SELECT
    COALESCE(SUM(duration_seconds) / 3600.0, 0) as hours_online,
    COALESCE(SUM(CASE WHEN status = 'on-call' THEN duration_seconds ELSE 0 END) / 3600.0, 0) as active_call_hours
FROM time_blocks;

-- name: GetActivityStatsByAgentRange :one
WITH status_events AS (
    SELECT
        user_id,
        status,
        created_at,
        LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) as prev_event_time
    FROM agent_status
    WHERE user_id = ? AND created_at >= ? AND created_at < ?
),
time_blocks AS (
    SELECT
        user_id,
        status,
        TIMESTAMPDIFF(SECOND, prev_event_time, created_at) as duration_seconds
    FROM status_events
    WHERE prev_event_time IS NOT NULL
        AND status IN ('available', 'on-call', 'after-call-work')
)
SELECT
    COALESCE(SUM(duration_seconds) / 3600.0, 0) as hours_online,
    COALESCE(SUM(CASE WHEN status = 'on-call' THEN duration_seconds ELSE 0 END) / 3600.0, 0) as active_call_hours
FROM time_blocks;

-- -----------------------
-- Per-Agent Breakdown Queries
-- -----------------------

-- name: GetCallStatsByAgentForCompanyToday :many
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN t.call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN t.call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN t.duration > 0 THEN t.duration END), 0) as avg_duration
FROM users u
LEFT JOIN transcriptions t ON u.id = t.agent_id AND DATE(t.created_at) = CURDATE()
WHERE u.company_id = ? AND u.is_active = 1
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetCallStatsByAgentForCompanyYesterday :many
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN t.call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN t.call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN t.duration > 0 THEN t.duration END), 0) as avg_duration
FROM users u
LEFT JOIN transcriptions t ON u.id = t.agent_id AND DATE(t.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
WHERE u.company_id = ? AND u.is_active = 1
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetCallStatsByAgentForCompanyThisWeek :many
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN t.call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN t.call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN t.duration > 0 THEN t.duration END), 0) as avg_duration
FROM users u
LEFT JOIN transcriptions t ON u.id = t.agent_id
    AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
    AND t.created_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)
WHERE u.company_id = ? AND u.is_active = 1
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetCallStatsByAgentForCompanyThisMonth :many
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN t.call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN t.call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN t.duration > 0 THEN t.duration END), 0) as avg_duration
FROM users u
LEFT JOIN transcriptions t ON u.id = t.agent_id
    AND YEAR(t.created_at) = YEAR(CURDATE())
    AND MONTH(t.created_at) = MONTH(CURDATE())
WHERE u.company_id = ? AND u.is_active = 1
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetCallStatsByAgentForCompanyRange :many
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN t.call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN t.call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN t.duration > 0 THEN t.duration END), 0) as avg_duration
FROM users u
LEFT JOIN transcriptions t ON u.id = t.agent_id
    AND t.created_at >= ?
    AND t.created_at < ?
WHERE u.company_id = ? AND u.is_active = 1
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetTaskStatsByAgentForCompanyToday :many
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
FROM users u
LEFT JOIN tasks t ON u.id = t.assigned_to AND DATE(t.created_at) = CURDATE()
WHERE u.company_id = ? AND u.is_active = 1
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetTaskStatsByAgentForCompanyYesterday :many
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
FROM users u
LEFT JOIN tasks t ON u.id = t.assigned_to AND DATE(t.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
WHERE u.company_id = ? AND u.is_active = 1
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetTaskStatsByAgentForCompanyThisWeek :many
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
FROM users u
LEFT JOIN tasks t ON u.id = t.assigned_to
    AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
    AND t.created_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)
WHERE u.company_id = ? AND u.is_active = 1
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetTaskStatsByAgentForCompanyThisMonth :many
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
FROM users u
LEFT JOIN tasks t ON u.id = t.assigned_to
    AND YEAR(t.created_at) = YEAR(CURDATE())
    AND MONTH(t.created_at) = MONTH(CURDATE())
WHERE u.company_id = ? AND u.is_active = 1
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetTaskStatsByAgentForCompanyRange :many
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
FROM users u
LEFT JOIN tasks t ON u.id = t.assigned_to
    AND t.created_at >= ?
    AND t.created_at < ?
WHERE u.company_id = ? AND u.is_active = 1
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetCallStatsByAgentForManagerToday :many
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN t.call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN t.call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN t.duration > 0 THEN t.duration END), 0) as avg_duration
FROM users u
LEFT JOIN transcriptions t ON u.id = t.agent_id AND DATE(t.created_at) = CURDATE()
WHERE u.id IN (SELECT id FROM subordinates)
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetCallStatsByAgentForManagerYesterday :many
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN t.call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN t.call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN t.duration > 0 THEN t.duration END), 0) as avg_duration
FROM users u
LEFT JOIN transcriptions t ON u.id = t.agent_id AND DATE(t.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
WHERE u.id IN (SELECT id FROM subordinates)
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetCallStatsByAgentForManagerThisWeek :many
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN t.call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN t.call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN t.duration > 0 THEN t.duration END), 0) as avg_duration
FROM users u
LEFT JOIN transcriptions t ON u.id = t.agent_id
    AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
    AND t.created_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)
WHERE u.id IN (SELECT id FROM subordinates)
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetCallStatsByAgentForManagerThisMonth :many
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN t.call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN t.call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN t.duration > 0 THEN t.duration END), 0) as avg_duration
FROM users u
LEFT JOIN transcriptions t ON u.id = t.agent_id
    AND YEAR(t.created_at) = YEAR(CURDATE())
    AND MONTH(t.created_at) = MONTH(CURDATE())
WHERE u.id IN (SELECT id FROM subordinates)
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetCallStatsByAgentForManagerRange :many
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN t.call_status = 'completed' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN t.call_status IN ('no-answer', 'busy', 'failed') THEN 1 END) as missed_calls,
    COALESCE(AVG(CASE WHEN t.duration > 0 THEN t.duration END), 0) as avg_duration
FROM users u
LEFT JOIN transcriptions t ON u.id = t.agent_id
    AND t.created_at >= ?
    AND t.created_at < ?
WHERE u.id IN (SELECT id FROM subordinates)
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetTaskStatsByAgentForManagerToday :many
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
FROM users u
LEFT JOIN tasks t ON u.id = t.assigned_to AND DATE(t.created_at) = CURDATE()
WHERE u.id IN (SELECT id FROM subordinates)
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetTaskStatsByAgentForManagerYesterday :many
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
FROM users u
LEFT JOIN tasks t ON u.id = t.assigned_to AND DATE(t.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
WHERE u.id IN (SELECT id FROM subordinates)
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetTaskStatsByAgentForManagerThisWeek :many
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
FROM users u
LEFT JOIN tasks t ON u.id = t.assigned_to
    AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
    AND t.created_at < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)
WHERE u.id IN (SELECT id FROM subordinates)
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetTaskStatsByAgentForManagerThisMonth :many
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
FROM users u
LEFT JOIN tasks t ON u.id = t.assigned_to
    AND YEAR(t.created_at) = YEAR(CURDATE())
    AND MONTH(t.created_at) = MONTH(CURDATE())
WHERE u.id IN (SELECT id FROM subordinates)
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;

-- name: GetTaskStatsByAgentForManagerRange :many
WITH RECURSIVE subordinates AS (
    SELECT u.id FROM users u WHERE u.reports_to = ? AND u.company_id = ? AND u.is_active = 1
    UNION ALL
    SELECT u.id FROM users u INNER JOIN subordinates s ON u.reports_to = s.id WHERE u.company_id = ? AND u.is_active = 1
)
SELECT
    u.id as agent_id,
    u.firstname,
    u.lastname,
    u.agent_id as agent_identifier,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
FROM users u
LEFT JOIN tasks t ON u.id = t.assigned_to
    AND t.created_at >= ?
    AND t.created_at < ?
WHERE u.id IN (SELECT id FROM subordinates)
GROUP BY u.id, u.firstname, u.lastname, u.agent_id
ORDER BY u.firstname ASC, u.lastname ASC;
