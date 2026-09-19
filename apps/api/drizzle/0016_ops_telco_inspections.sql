CREATE TABLE IF NOT EXISTS `ops_telco_inspections` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `category` varchar(50) NOT NULL,
  `inspection_date` date NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `item_condition` varchar(50) NOT NULL DEFAULT 'baik',
  `location` varchar(255) NULL,
  `notes` text NULL,
  `action_taken` text NULL,
  `photos` text NULL,
  `inspected_by` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT NOW(),
  `updated_at` timestamp NOT NULL DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP,
  INDEX `ops_telco_inspections_cat_idx` (`category`),
  INDEX `ops_telco_inspections_date_idx` (`inspection_date`),
  INDEX `ops_telco_inspections_cond_idx` (`item_condition`),
  INDEX `ops_telco_inspections_user_idx` (`inspected_by`),
  CONSTRAINT `ops_telco_inspections_user_fk` FOREIGN KEY (`inspected_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
);
