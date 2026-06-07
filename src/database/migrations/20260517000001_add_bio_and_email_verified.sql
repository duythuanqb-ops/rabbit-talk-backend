-- Migration: Add email verification fields
-- Description: Adds email_verification_token, email_verification_expires, and is_email_verified columns.

ALTER TABLE users ADD COLUMN is_email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER avatar_url;
ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(255) DEFAULT NULL AFTER is_email_verified;
ALTER TABLE users ADD COLUMN email_verification_expires DATETIME DEFAULT NULL AFTER email_verification_token;
