-- Migration: Create users table
-- Fields: username, email, first_name, last_name, date_of_birth, password, uuid

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_uuid VARCHAR(36) NOT NULL,
    token VARCHAR(255) NOT NULL,
    device_info VARCHAR(255),
    ip_address VARCHAR(45),
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT FALSE,
    UNIQUE KEY (user_uuid, device_info),
    INDEX (token),
    FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE
);


-- Migration: Add Google Login Fields
-- Description: Adds google_id, auth_provider, avatar_url, and allows password to be NULL.

ALTER TABLE users 
  ADD COLUMN auth_provider ENUM('local', 'google') NOT NULL DEFAULT 'local' AFTER uuid,
  ADD COLUMN google_id VARCHAR(255) UNIQUE DEFAULT NULL AFTER auth_provider,
  ADD COLUMN avatar_url VARCHAR(255) DEFAULT NULL AFTER last_name;

ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL;


-- Migration: Add email verification fields
-- Description: Adds email_verification_token, email_verification_expires, and is_email_verified columns.

ALTER TABLE users ADD COLUMN is_email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER avatar_url;
ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(255) DEFAULT NULL AFTER is_email_verified;
ALTER TABLE users ADD COLUMN email_verification_expires DATETIME DEFAULT NULL AFTER email_verification_token;


-- Migration: Add bio column
-- Description: Adds bio column to users table if it doesn't exist.

ALTER TABLE users ADD COLUMN bio VARCHAR(500) DEFAULT NULL AFTER google_id;


ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'student';

CREATE TABLE teacher_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_uuid VARCHAR(36) NOT NULL UNIQUE,
    headline VARCHAR(255) NOT NULL,
    experience_years INT NOT NULL,
    video_intro_url VARCHAR(255) DEFAULT NULL,
    certificates TEXT DEFAULT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE
);


-- Migration: Update role column to ENUM type
-- Description: Changes role from VARCHAR(50) to ENUM('admin', 'student', 'teacher') with 'student' as default.

ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'student', 'teacher') NOT NULL DEFAULT 'student';


-- Create groups table
CREATE TABLE IF NOT EXISTS `groups` (
  `id` varchar(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `avatar` varchar(255),
  `created_by` varchar(36) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`uuid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create group_members table
CREATE TABLE IF NOT EXISTS `group_members` (
  `id` varchar(36) NOT NULL,
  `group_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `joined_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_group_user` (`group_id`, `user_id`),
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`uuid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Create friendships table for managing friend requests and relations
CREATE TABLE IF NOT EXISTS `friendships` (
  `id` VARCHAR(36) NOT NULL,
  `sender_id` VARCHAR(36) NOT NULL,
  `receiver_id` VARCHAR(36) NOT NULL,
  `status` ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sender_receiver` (`sender_id`, `receiver_id`),
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`uuid`) ON DELETE CASCADE,
  FOREIGN KEY (`receiver_id`) REFERENCES `users`(`uuid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


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


-- Add gamification columns to users table
ALTER TABLE `users` ADD COLUMN `xp` INT NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `day_streak` INT NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `league` VARCHAR(50) NOT NULL DEFAULT 'Bronze';


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


-- Add start_date and allow_retry to exams
ALTER TABLE `exams` ADD COLUMN `start_date` TIMESTAMP NULL;
ALTER TABLE `exams` ADD COLUMN `allow_retry` TINYINT(1) DEFAULT 0;


-- Migration: Add password_reset_token and password_reset_expires columns to users table
-- Description: Adds columns to support the forgot password flow.

ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255) DEFAULT NULL AFTER email_verification_expires;
ALTER TABLE users ADD COLUMN password_reset_expires DATETIME DEFAULT NULL AFTER password_reset_token;


-- Add cover_url column to users table for profile cover image
ALTER TABLE `users` ADD COLUMN `cover_url` VARCHAR(255) DEFAULT NULL;


