-- Migrasi 0009: Oncall Schedule Management (Assign & View Jadwal Oncall)
-- 1. Buat tabel oncall_crew_members
-- 2. Buat tabel oncall_schedules
-- 3. Buat tabel oncall_schedule_slots

CREATE TABLE IF NOT EXISTS `oncall_crew_members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `crew_type` VARCHAR(24) NOT NULL,
  `user_id` INT NOT NULL,
  `sequence_order` INT NOT NULL DEFAULT 0,
  `is_active` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `oncall_crew_members_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE INDEX `oncall_crew_members_crew_user_unique` (`crew_type`, `user_id`),
  INDEX `oncall_crew_members_crew_type_idx` (`crew_type`),
  INDEX `oncall_crew_members_sequence_idx` (`sequence_order`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `oncall_schedules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(160) NOT NULL,
  `period_label` VARCHAR(100) NOT NULL,
  `period_index` INT NOT NULL DEFAULT 1,
  `year` INT NOT NULL DEFAULT 2026,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'active',
  `notes` TEXT NULL,
  `telco_supervisor_name` VARCHAR(100) NOT NULL DEFAULT 'Rahmansyah',
  `telco_supervisor_phone` VARCHAR(50) NOT NULL DEFAULT '( 0852 4691 9549 )',
  `osp_supervisor_name` VARCHAR(100) NOT NULL DEFAULT 'Bronson H.',
  `osp_supervisor_phone` VARCHAR(50) NOT NULL DEFAULT '(081254700404)',
  `superintendent_name` VARCHAR(100) NOT NULL DEFAULT '( Wanto )',
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `oncall_schedules_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  INDEX `oncall_schedules_year_period_idx` (`year`, `period_index`),
  INDEX `oncall_schedules_status_idx` (`status`),
  INDEX `oncall_schedules_created_by_idx` (`created_by`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `oncall_schedule_slots` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `schedule_id` INT NOT NULL,
  `slot_number` INT NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `date_1` DATE NOT NULL,
  `date_2` DATE NOT NULL,
  `date_3` DATE NOT NULL,
  `telco_user_id` INT NOT NULL,
  `osp_user_id` INT NOT NULL,
  `is_override` BOOLEAN NOT NULL DEFAULT FALSE,
  `override_reason` VARCHAR(255) NULL,
  `notes` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `oncall_slots_schedule_fk` FOREIGN KEY (`schedule_id`) REFERENCES `oncall_schedules`(`id`) ON DELETE CASCADE,
  CONSTRAINT `oncall_slots_telco_user_fk` FOREIGN KEY (`telco_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `oncall_slots_osp_user_fk` FOREIGN KEY (`osp_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  UNIQUE INDEX `oncall_slots_schedule_slot_unique` (`schedule_id`, `slot_number`),
  INDEX `oncall_slots_schedule_idx` (`schedule_id`),
  INDEX `oncall_slots_telco_user_idx` (`telco_user_id`),
  INDEX `oncall_slots_osp_user_idx` (`osp_user_id`)
);
