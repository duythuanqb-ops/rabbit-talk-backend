-- Migration: Update role column to ENUM type
-- Description: Changes role from VARCHAR(50) to ENUM('admin', 'student', 'teacher') with 'student' as default.

DELIMITER //

CREATE PROCEDURE UpdateRoleToEnum()
BEGIN
    IF EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'role' AND TABLE_SCHEMA = DATABASE()
    ) THEN
        ALTER TABLE users
            MODIFY COLUMN role ENUM('admin', 'student', 'teacher') NOT NULL DEFAULT 'student';
    ELSE
        ALTER TABLE users
            ADD COLUMN role ENUM('admin', 'student', 'teacher') NOT NULL DEFAULT 'student';
    END IF;
END //

DELIMITER ;

CALL UpdateRoleToEnum();

DROP PROCEDURE UpdateRoleToEnum;
