-- Add start_date and allow_retry to exams
ALTER TABLE `exams` ADD COLUMN `start_date` TIMESTAMP NULL;
ALTER TABLE `exams` ADD COLUMN `allow_retry` TINYINT(1) DEFAULT 0;
