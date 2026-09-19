CREATE TABLE IF NOT EXISTS `employee_contracts` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `contract_number` varchar(80) NOT NULL,
  `sequence_number` int NOT NULL DEFAULT 1,
  `contract_type` varchar(50) NOT NULL DEFAULT 'PKWT',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'active',
  `position` varchar(100) NULL,
  `notes` text NULL,
  `reminder_sent_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT NOW(),
  `updated_at` timestamp NOT NULL DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP,
  INDEX `employee_contracts_user_idx` (`user_id`),
  INDEX `employee_contracts_dates_idx` (`end_date`, `status`),
  CONSTRAINT `employee_contracts_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `menus` (`title`, `description`, `icon`, `url`, `sort_order`, `is_active`, `required_permission`)
VALUES ('Personal', 'Data diri personal, riwayat kontrak kerja, dan status perpanjangan kontrak', 'user-circle', '/portal/personal', 3, 1, NULL)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `description` = VALUES(`description`), `icon` = VALUES(`icon`), `is_active` = 1, `sort_order` = 3;
--> statement-breakpoint
UPDATE `users` SET `start_date` = '2024-01-02' WHERE `email` = 'kala@mknsite.online' AND `start_date` IS NULL;
--> statement-breakpoint
UPDATE `users` SET `start_date` = '2023-06-01' WHERE `email` = 'asrianto@mknsite.online' AND `start_date` IS NULL;
--> statement-breakpoint
UPDATE `users` SET `start_date` = '2024-02-15' WHERE `email` = 'indra@mknsite.online' AND `start_date` IS NULL;
--> statement-breakpoint
UPDATE `users` SET `start_date` = '2023-11-01' WHERE `email` = 'jacky@mknsite.online' AND `start_date` IS NULL;
--> statement-breakpoint
INSERT INTO `employee_contracts` (`user_id`, `contract_number`, `sequence_number`, `contract_type`, `start_date`, `end_date`, `status`, `position`, `notes`)
SELECT u.id, '015/PKWT-MKN/I/2024', 1, 'PKWT Awal', '2024-01-02', '2024-12-31', 'extended', 'Teknisi Telco', 'Kontrak kerja waktu tertentu tahun pertama'
FROM `users` u WHERE u.email = 'kala@mknsite.online'
AND NOT EXISTS (SELECT 1 FROM `employee_contracts` ec WHERE ec.user_id = u.id AND ec.sequence_number = 1);
--> statement-breakpoint
INSERT INTO `employee_contracts` (`user_id`, `contract_number`, `sequence_number`, `contract_type`, `start_date`, `end_date`, `status`, `position`, `notes`)
SELECT u.id, '048/PKWT-EXT1/MKN/I/2025', 2, 'Perpanjangan Ke-1', '2025-01-01', '2025-12-31', 'extended', 'Teknisi Telco Senior', 'Perpanjangan kontrak kerja tahun kedua berdasarkan evaluasi performa sangat baik'
FROM `users` u WHERE u.email = 'kala@mknsite.online'
AND NOT EXISTS (SELECT 1 FROM `employee_contracts` ec WHERE ec.user_id = u.id AND ec.sequence_number = 2);
--> statement-breakpoint
INSERT INTO `employee_contracts` (`user_id`, `contract_number`, `sequence_number`, `contract_type`, `start_date`, `end_date`, `status`, `position`, `notes`)
SELECT u.id, '088/PKWT-EXT2/MKN/I/2026', 3, 'Perpanjangan Ke-2', '2026-01-01', DATE_ADD(CURRENT_DATE(), INTERVAL 25 DAY), 'active', 'Teknisi Telco Senior', 'Perpanjangan kontrak kerja tahun ketiga (dalam periode evaluasi akhir)'
FROM `users` u WHERE u.email = 'kala@mknsite.online'
AND NOT EXISTS (SELECT 1 FROM `employee_contracts` ec WHERE ec.user_id = u.id AND ec.sequence_number = 3);
