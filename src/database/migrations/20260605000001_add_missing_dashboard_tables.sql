-- Create flashcard_sets table
CREATE TABLE IF NOT EXISTS `flashcard_sets` (
  `id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create flashcards table
CREATE TABLE IF NOT EXISTS `flashcards` (
  `id` VARCHAR(36) NOT NULL,
  `set_id` VARCHAR(36) NOT NULL,
  `word` VARCHAR(255) NOT NULL,
  `translation` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`set_id`) REFERENCES `flashcard_sets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create student_flashcard_progress table
CREATE TABLE IF NOT EXISTS `student_flashcard_progress` (
  `id` VARCHAR(36) NOT NULL,
  `student_id` VARCHAR(36) NOT NULL,
  `flashcard_id` VARCHAR(36) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'new', -- 'new', 'learning', 'mastered'
  `last_reviewed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `users`(`uuid`) ON DELETE CASCADE,
  FOREIGN KEY (`flashcard_id`) REFERENCES `flashcards`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_student_flashcard` (`student_id`, `flashcard_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create student_exam_attempts table if not exists
CREATE TABLE IF NOT EXISTS `student_exam_attempts` (
  `id` VARCHAR(36) NOT NULL,
  `student_id` VARCHAR(36) NOT NULL,
  `exam_id` VARCHAR(36) NOT NULL,
  `score` INT NOT NULL DEFAULT 0,
  `completed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `users`(`uuid`) ON DELETE CASCADE,
  FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
