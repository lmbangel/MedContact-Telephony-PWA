-- +goose Up
ALTER TABLE users
    ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'agent',
    ADD COLUMN phone VARCHAR(50) NULL,
    ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN reports_to INT NULL,
    ADD INDEX idx_role (role),
    ADD INDEX idx_is_active (is_active),
    ADD INDEX idx_reports_to (reports_to),
    ADD CONSTRAINT fk_users_reports_to FOREIGN KEY (reports_to) REFERENCES users(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE users
    DROP FOREIGN KEY fk_users_reports_to,
    DROP INDEX idx_reports_to,
    DROP INDEX idx_is_active,
    DROP INDEX idx_role,
    DROP COLUMN reports_to,
    DROP COLUMN is_active,
    DROP COLUMN phone,
    DROP COLUMN role;
