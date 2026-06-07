-- Add is_starred column to student_flashcard_progress (if not exists)
ALTER TABLE `student_flashcard_progress` ADD COLUMN `is_starred` TINYINT(1) DEFAULT 0;

-- Create student_custom_words table for words added by student
CREATE TABLE IF NOT EXISTS `student_custom_words` (
  `id` VARCHAR(36) NOT NULL,
  `student_id` VARCHAR(36) NOT NULL,
  `word` VARCHAR(255) NOT NULL,
  `meaning` VARCHAR(500),
  `phonetic` VARCHAR(255),
  `example_sentence` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `users`(`uuid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
