-- Create exams table
CREATE TABLE IF NOT EXISTS `exams` (
  `id` varchar(36) NOT NULL,
  `group_id` varchar(36) NOT NULL,
  `teacher_id` varchar(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `is_published` TINYINT(1) DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`teacher_id`) REFERENCES `users`(`uuid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create exam_questions table
CREATE TABLE IF NOT EXISTS `exam_questions` (
  `id` varchar(36) NOT NULL,
  `exam_id` varchar(36) NOT NULL,
  `word` varchar(255) NOT NULL,
  `type` varchar(50) NOT NULL, -- 'synonym', 'listening', 'spelling', 'situation'
  `question_text` text NOT NULL,
  `options` text, -- JSON array of choices for multiple choice, null for spelling
  `correct_answer` varchar(255) NOT NULL, -- correct choice or spelling word
  `audio_url` varchar(1000), -- audio url for listening questions
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create student_exam_attempts table
CREATE TABLE IF NOT EXISTS `student_exam_attempts` (
  `id` varchar(36) NOT NULL,
  `student_id` varchar(36) NOT NULL,
  `exam_id` varchar(36) NOT NULL,
  `score` int NOT NULL,
  `total_questions` int NOT NULL,
  `answers` text, -- JSON map of question_id -> student_answer
  `completed_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `users`(`uuid`) ON DELETE CASCADE,
  FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
