-- Migration 0018: Portals LV MKN dan Safety
CREATE TABLE IF NOT EXISTS `lv_gps_info` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `imei` varchar(50) NOT NULL,
  `lv_number` varchar(50) NOT NULL,
  `gsm_number` varchar(50) NOT NULL,
  `sim_provider` varchar(50) DEFAULT 'Telkomsel',
  `active_until` date NULL,
  `notes` text NULL,
  `created_by` int NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX `lv_gps_info_imei_unique` (`imei`),
  INDEX `lv_gps_info_lv_number_idx` (`lv_number`),
  CONSTRAINT `lv_gps_info_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `lv_overspeed_logs` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `lv_number` varchar(50) NOT NULL,
  `location` varchar(255) NOT NULL,
  `speed` int NOT NULL,
  `speed_limit` int NOT NULL DEFAULT 60,
  `occurred_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `driver_name` varchar(160) NULL,
  `notes` text NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `lv_overspeed_logs_lv_number_idx` (`lv_number`),
  INDEX `lv_overspeed_logs_occurred_at_idx` (`occurred_at`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `lv_commissioning` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `lv_number` varchar(50) NOT NULL,
  `kpc_commissioning_no` varchar(100) NULL,
  `validity_date` date NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'Aktif',
  `reminder_email` varchar(191) NULL,
  `last_reminder_sent_at` timestamp NULL,
  `notes` text NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `lv_commissioning_lv_number_idx` (`lv_number`),
  INDEX `lv_commissioning_validity_date_idx` (`validity_date`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `safety_permits` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `permit_number` varchar(100) NOT NULL,
  `permit_type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `location` varchar(255) NOT NULL,
  `gps_coordinates` varchar(100) NULL,
  `start_date` date NULL,
  `end_date` date NULL,
  `status` varchar(50) NOT NULL DEFAULT 'Draft',
  `pic_name` varchar(160) NULL,
  `pic_phone` varchar(50) NULL,
  `scanned_doc_url` varchar(500) NULL,
  `description` text NULL,
  `additional_data` text NULL,
  `created_by` int NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX `safety_permits_number_unique` (`permit_number`),
  INDEX `safety_permits_permit_type_idx` (`permit_type`),
  INDEX `safety_permits_status_idx` (`status`),
  CONSTRAINT `safety_permits_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `safety_trainings` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `course_code` varchar(50) NOT NULL,
  `course_title` varchar(255) NOT NULL,
  `category` varchar(100) NOT NULL DEFAULT 'SAFETY',
  `description` text NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `safety_trainings_code_unique` (`course_code`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `safety_employee_trainings` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `badge_number` varchar(50) NOT NULL,
  `employee_name` varchar(160) NOT NULL,
  `position_title` varchar(160) NULL,
  `department` varchar(100) NULL,
  `course_code` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'c',
  `training_date` date NULL,
  `expiry_date` date NULL,
  `certificate_url` varchar(500) NULL,
  `notes` text NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `safety_emp_trainings_badge_idx` (`badge_number`),
  INDEX `safety_emp_trainings_course_idx` (`course_code`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `safety_messages` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `month_year` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NULL,
  `document_url` varchar(500) NULL,
  `attendee_name` varchar(160) NULL,
  `attendee_badge` varchar(50) NULL,
  `signature_data` text NULL,
  `signed_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `safety_messages_month_year_idx` (`month_year`)
);
