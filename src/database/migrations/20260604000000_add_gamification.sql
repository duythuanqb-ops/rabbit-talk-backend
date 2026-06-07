-- Add gamification fields to users table
ALTER TABLE `users` ADD COLUMN `xp` INT DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `day_streak` INT DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `league` VARCHAR(50) DEFAULT 'Bronze';

-- Create achievements table
CREATE TABLE IF NOT EXISTS `user_achievements` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `icon` VARCHAR(50) DEFAULT '🏆',
  `bg_color` VARCHAR(50) DEFAULT 'bg-slate-100',
  `earned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`uuid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
