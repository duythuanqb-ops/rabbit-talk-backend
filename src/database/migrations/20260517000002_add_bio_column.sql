-- Migration: Add bio column
-- Description: Adds bio column to users table if it doesn't exist.

ALTER TABLE users ADD COLUMN bio VARCHAR(500) DEFAULT NULL AFTER google_id;
