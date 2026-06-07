-- Migration: Add password_reset_token and password_reset_expires columns to users table
-- Description: Adds columns to support the forgot password flow.

ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255) DEFAULT NULL AFTER email_verification_expires;
ALTER TABLE users ADD COLUMN password_reset_expires DATETIME DEFAULT NULL AFTER password_reset_token;
