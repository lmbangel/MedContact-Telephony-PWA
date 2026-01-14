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
