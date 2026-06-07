-- Add cover_url column to users table for profile cover image
ALTER TABLE `users` ADD COLUMN `cover_url` VARCHAR(255) DEFAULT NULL;
