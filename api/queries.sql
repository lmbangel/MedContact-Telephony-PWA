-- name: GetCompany :one
SELECT * FROM companies WHERE id = ?;

-- name: GetAllCompanies :many
SELECT * FROM companies ORDER BY created_at DESC;

-- name: CreateCompany :one
INSERT INTO companies (name) VALUES (?) RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = ?;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = ?;

-- name: GetUserByAgentID :one
SELECT * FROM users WHERE agent_id = ?;

-- name: CreateUser :one
INSERT INTO users (email, password_hash, firstname, lastname, agent_id, company_id)
VALUES (?, ?, ?, ?, ?, ?) RETURNING *;

-- name: GetSession :one
SELECT * FROM sessions WHERE id = ?;

-- name: CreateSession :one
INSERT INTO sessions (id, user_id, expires_at)
VALUES (?, ?, ?) RETURNING *;

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

-- name: CreateCustomer :one
INSERT INTO customers (company_id, first_name, last_name, email, phone, medical_aid_provider, medical_aid_number, medical_plan)
VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- -----------------------
-- Customer Premium Queries
-- -----------------------

-- name: GetCustomerPremiumsByCustomerID :many
SELECT * FROM customer_premiums WHERE customer_id = ? ORDER BY effective_date DESC;

-- name: CreateCustomerPremium :one
INSERT INTO customer_premiums (customer_id, premium_amount, effective_date)
VALUES (?, ?, ?) RETURNING *;
