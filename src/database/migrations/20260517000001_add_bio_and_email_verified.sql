-- Migration: Add email verification fields
-- Description: Adds email_verification_token, email_verification_expires, and is_email_verified columns.

DELIMITER //

CREATE PROCEDURE AddEmailVerificationFields()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'is_email_verified' AND TABLE_SCHEMA = DATABASE()
    ) THEN
        ALTER TABLE users
          ADD COLUMN is_email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER avatar_url;
    END IF;

    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verification_token' AND TABLE_SCHEMA = DATABASE()
    ) THEN
        ALTER TABLE users
          ADD COLUMN email_verification_token VARCHAR(255) DEFAULT NULL AFTER is_email_verified;
    END IF;

    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verification_expires' AND TABLE_SCHEMA = DATABASE()
    ) THEN
        ALTER TABLE users
          ADD COLUMN email_verification_expires DATETIME DEFAULT NULL AFTER email_verification_token;
    END IF;
END //

DELIMITER ;

CALL AddEmailVerificationFields();

DROP PROCEDURE AddEmailVerificationFields;
