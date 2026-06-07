-- Add gamification columns to users table
ALTER TABLE `users` ADD COLUMN `xp` INT NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `day_streak` INT NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `league` VARCHAR(50) NOT NULL DEFAULT 'Bronze';
