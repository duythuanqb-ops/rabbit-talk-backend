-- Migration: Add Google Login Fields
-- Description: Adds google_id, auth_provider, avatar_url, and allows password to be NULL.

DELIMITER //

CREATE PROCEDURE AddGoogleLoginFields()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'auth_provider' AND TABLE_SCHEMA = DATABASE()
    ) THEN
        ALTER TABLE users 
          ADD COLUMN auth_provider ENUM('local', 'google') NOT NULL DEFAULT 'local' AFTER uuid,
          ADD COLUMN google_id VARCHAR(255) UNIQUE DEFAULT NULL AFTER auth_provider,
          ADD COLUMN avatar_url VARCHAR(255) DEFAULT NULL AFTER last_name;
    END IF;
    
    ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL;
END //

DELIMITER ;

CALL AddGoogleLoginFields();

DROP PROCEDURE AddGoogleLoginFields;
