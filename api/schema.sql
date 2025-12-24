-- MedContact System Database Schema

-- Create database
CREATE DATABASE IF NOT EXISTS medcontact CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medcontact;

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    agent_id VARCHAR(50) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_agent_id (agent_id),
    INDEX idx_company_id (company_id),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OTP codes table
CREATE TABLE IF NOT EXISTS otp_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    medical_aid_provider VARCHAR(255),
    medical_aid_number VARCHAR(100),
    medical_plan VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_company_id (company_id),
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_medical_aid_number (medical_aid_number),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Call outcomes table
CREATE TABLE IF NOT EXISTS call_outcomes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(50),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transcriptions table (call logs)
CREATE TABLE IF NOT EXISTS transcriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    agent_id INT,
    company_id INT NOT NULL,
    call_sid VARCHAR(255) NOT NULL,
    recording_sid VARCHAR(255),
    recording_url TEXT,
    recording_duration INT,
    recording_status VARCHAR(50),
    recording_channels INT,
    recording_start_time TIMESTAMP,
    transcript TEXT,
    summary TEXT,
    from_number VARCHAR(50),
    to_number VARCHAR(50),
    call_status VARCHAR(50),
    duration INT,
    call_reason VARCHAR(255),
    transcription_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_agent_id (agent_id),
    INDEX idx_company_id (company_id),
    INDEX idx_call_sid (call_sid),
    INDEX idx_call_status (call_status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Call notes table
CREATE TABLE IF NOT EXISTS call_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    call_id INT,
    agent_id INT NOT NULL,
    customer_id INT,
    outcome VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_call_id (call_id),
    INDEX idx_agent_id (agent_id),
    INDEX idx_customer_id (customer_id),
    FOREIGN KEY (call_id) REFERENCES transcriptions(id) ON DELETE SET NULL,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assigned_to INT NOT NULL,
    customer_id INT,
    call_id INT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'task',
    status VARCHAR(50) DEFAULT 'pending',
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_customer_id (customer_id),
    INDEX idx_call_id (call_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date),
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (call_id) REFERENCES transcriptions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agent status table
CREATE TABLE IF NOT EXISTS agent_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'offline',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer premiums table
CREATE TABLE IF NOT EXISTS customer_premiums (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    premium_amount DECIMAL(10,2) NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_effective_date (effective_date),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Member flags table
CREATE TABLE IF NOT EXISTS member_flags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    flag_type VARCHAR(100) NOT NULL,
    flag_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_flag_type (flag_type),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample companies
INSERT INTO companies (name) VALUES
('General Practice'),
('Dental Clinic'),
('Specialist Clinic'),
('Telehealth Services')
ON DUPLICATE KEY UPDATE name = name;

-- Insert sample call outcomes
INSERT INTO call_outcomes (name, category) VALUES
('Answered', 'success'),
('Voicemail', 'partial'),
('Busy', 'failed'),
('No Answer', 'failed'),
('Callback Requested', 'pending')
ON DUPLICATE KEY UPDATE name = name;
