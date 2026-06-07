-- Migration: Update role column to ENUM type
-- Description: Changes role from VARCHAR(50) to ENUM('admin', 'student', 'teacher') with 'student' as default.

ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'student', 'teacher') NOT NULL DEFAULT 'student';
