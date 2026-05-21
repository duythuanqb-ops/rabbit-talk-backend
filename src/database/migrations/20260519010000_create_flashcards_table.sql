-- Create Flashcard Sets Table
CREATE TABLE IF NOT EXISTS `flashcard_sets` (
  `id` VARCHAR(36) PRIMARY KEY,
  `group_id` VARCHAR(36) NOT NULL,
  `teacher_id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `is_published` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`teacher_id`) REFERENCES `users`(`uuid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create Flashcards Table
CREATE TABLE IF NOT EXISTS `flashcards` (
  `id` VARCHAR(36) PRIMARY KEY,
  `set_id` VARCHAR(36) NOT NULL,
  `word` VARCHAR(255) NOT NULL,
  `phonetic` VARCHAR(255),
  `part_of_speech` VARCHAR(50),
  `meaning` VARCHAR(500),
  `synonyms` VARCHAR(255),
  `example_sentence` TEXT,
  `audio_url` VARCHAR(1000),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`set_id`) REFERENCES `flashcard_sets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create Student Flashcard Progress Table
CREATE TABLE IF NOT EXISTS `student_flashcard_progress` (
  `id` VARCHAR(36) PRIMARY KEY,
  `student_id` VARCHAR(36) NOT NULL,
  `flashcard_id` VARCHAR(36) NOT NULL,
  `status` ENUM('learning', 'mastered') DEFAULT 'learning',
  `last_reviewed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_student_flashcard` (`student_id`, `flashcard_id`),
  FOREIGN KEY (`student_id`) REFERENCES `users`(`uuid`) ON DELETE CASCADE,
  FOREIGN KEY (`flashcard_id`) REFERENCES `flashcards`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
