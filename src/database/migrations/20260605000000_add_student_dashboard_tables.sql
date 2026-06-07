-- Add due_date to exams
ALTER TABLE `exams` ADD COLUMN `due_date` TIMESTAMP NULL;

-- Create daily_quests table
CREATE TABLE IF NOT EXISTS `daily_quests` (
  `id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `xp_reward` INT NOT NULL DEFAULT 50,
  `type` VARCHAR(50) NOT NULL, -- 'learn_words', 'take_exam', 'score_80'
  `target_value` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create student_quest_progress table
CREATE TABLE IF NOT EXISTS `student_quest_progress` (
  `id` VARCHAR(36) NOT NULL,
  `student_id` VARCHAR(36) NOT NULL,
  `quest_id` VARCHAR(36) NOT NULL,
  `current_value` INT NOT NULL DEFAULT 0,
  `is_completed` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `users`(`uuid`) ON DELETE CASCADE,
  FOREIGN KEY (`quest_id`) REFERENCES `daily_quests`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_student_quest_today` (`student_id`, `quest_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create student_attendance table
CREATE TABLE IF NOT EXISTS `student_attendance` (
  `id` VARCHAR(36) NOT NULL,
  `student_id` VARCHAR(36) NOT NULL,
  `date` DATE NOT NULL,
  `xp_earned` INT DEFAULT 10,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `users`(`uuid`) ON DELETE CASCADE,
  UNIQUE KEY `unique_student_date` (`student_id`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
