-- Migration: Add bio column
-- Description: Adds bio column to users table if it doesn't exist.

DELIMITER //

CREATE PROCEDURE AddBioColumn()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'bio' AND TABLE_SCHEMA = DATABASE()
    ) THEN
        ALTER TABLE users
          ADD COLUMN bio VARCHAR(500) DEFAULT NULL AFTER google_id;
    END IF;
END //

DELIMITER ;

CALL AddBioColumn();

DROP PROCEDURE AddBioColumn;
