CREATE TABLE IF NOT EXISTS `ops_telco_handovers` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `handover_date` date NOT NULL,
  `description` text NOT NULL,
  `photos` text NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT NOW(),
  `updated_at` timestamp NOT NULL DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP,
  INDEX `ops_telco_handovers_date_idx` (`handover_date`),
  INDEX `ops_telco_handovers_created_by_idx` (`created_by`),
  CONSTRAINT `ops_telco_handovers_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
);
