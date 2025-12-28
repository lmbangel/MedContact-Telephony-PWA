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
