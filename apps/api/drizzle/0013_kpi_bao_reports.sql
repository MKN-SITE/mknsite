CREATE TABLE IF NOT EXISTS `kpi_companies` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(160) NOT NULL,
  `type` varchar(32) NOT NULL DEFAULT 'kpc',
  `client_company_name` varchar(200) NULL,
  `client_address` text NULL,
  `contract_title` text NULL,
  `service_description` text NULL,
  `mkn_signer_name` varchar(120) NULL,
  `mkn_signer_role` varchar(120) NULL,
  `client_signer_name` varchar(120) NULL,
  `client_signer_role` varchar(120) NULL,
  `client_signer_location` varchar(120) NULL,
  `is_active` boolean NOT NULL DEFAULT true,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT NOW(),
  `updated_at` timestamp NOT NULL DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP,
  INDEX `kpi_companies_type_idx` (`type`),
  INDEX `kpi_companies_active_idx` (`is_active`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kpi_devices` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `company_id` int NOT NULL,
  `device_name` varchar(160) NOT NULL,
  `location` varchar(160) NULL,
  `order_index` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT NOW(),
  `updated_at` timestamp NOT NULL DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP,
  INDEX `kpi_devices_company_idx` (`company_id`),
  CONSTRAINT `kpi_devices_company_fk` FOREIGN KEY (`company_id`) REFERENCES `kpi_companies` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kpi_holidays` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `holiday_date` date NOT NULL,
  `description` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT NOW(),
  `updated_at` timestamp NOT NULL DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX `kpi_holidays_date_unique` (`holiday_date`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kpi_reports` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `company_id` int NOT NULL,
  `year` int NOT NULL,
  `month` int NOT NULL,
  `overall_availability` varchar(32) NOT NULL DEFAULT '100.00',
  `bao_date` date NULL,
  `bao_number` varchar(100) NULL,
  `status` varchar(32) NOT NULL DEFAULT 'draft',
  `created_by` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT NOW(),
  `updated_at` timestamp NOT NULL DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX `kpi_reports_company_period_unique` (`company_id`, `year`, `month`),
  INDEX `kpi_reports_company_idx` (`company_id`),
  INDEX `kpi_reports_period_idx` (`year`, `month`),
  CONSTRAINT `kpi_reports_company_fk` FOREIGN KEY (`company_id`) REFERENCES `kpi_companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kpi_reports_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kpi_report_problems` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `report_id` int NOT NULL,
  `device_id` int NOT NULL,
  `problem_date` date NOT NULL,
  `downtime_hours` int NOT NULL DEFAULT 0,
  `downtime_minutes` int NOT NULL DEFAULT 0,
  `downtime_seconds` int NOT NULL DEFAULT 0,
  `total_seconds` int NOT NULL DEFAULT 0,
  `description` text NULL,
  `created_at` timestamp NOT NULL DEFAULT NOW(),
  `updated_at` timestamp NOT NULL DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP,
  INDEX `kpi_report_problems_report_idx` (`report_id`),
  INDEX `kpi_report_problems_device_idx` (`device_id`),
  INDEX `kpi_report_problems_date_idx` (`problem_date`),
  CONSTRAINT `kpi_report_problems_report_fk` FOREIGN KEY (`report_id`) REFERENCES `kpi_reports` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kpi_report_problems_device_fk` FOREIGN KEY (`device_id`) REFERENCES `kpi_devices` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
-- Seed initial companies
INSERT INTO `kpi_companies` (`name`, `type`, `client_company_name`, `client_address`, `contract_title`, `service_description`, `mkn_signer_name`, `mkn_signer_role`, `client_signer_name`, `client_signer_role`, `client_signer_location`, `sort_order`, `is_active`)
VALUES
('KPC Microwave', 'kpc', 'PT KALTIM PRIMA COAL', 'PT Kaltim Prima Coal d/a ISD M3 Building mine Site Sangatta, Kalimantan Timur', 'pengadaan link Microwave Radio Transmissions, Contract KPC - 34 - 0044', 'Microwave Radio Transmission And Maintenance Support ( 15 Link )', 'Joko Triono', 'PJO', 'Suluh Basuki', 'ISD KPC', 'Sangatta', 1, true),
('KPC TBTS', 'kpc', 'PT KALTIM PRIMA COAL', 'PT Kaltim Prima Coal d/a ISD M3 Building mine Site Sangatta, Kalimantan Timur', 'Provision of Transportable Tower Rental for Mobile Repeater ( TBTS Galaxy ), Contract KPC - 34 - 0009', 'Transportable Base Transreceiver Station ( TBTS )', 'Joko Triono', 'PJO', 'Suluh Basuki', 'ISD KPC', 'Sangatta', 2, true),
('NAP', 'non-kpc', 'PT NAP INFO LINTAS NUSA', 'PT NAP Info Lintas Nusa Site d/a PT. Liebherr Site Sangatta', 'pengadaan link MRC Local Loop PT NAP Info Lintas Nusa 2 Mbps, PO No. 3639, tanggal 7- September-2020', 'Link MRC Local Loop PT NAP Info Lintas Nusa', 'Wanto', 'Project Manager', 'Maristella Swanda Libriyana Nainggolan', 'Costumer Relation Departement Head', 'Site Sangatta', 3, true),
('Hexindo', 'non-kpc', 'PT HEXINDO ADIPERKASA, TBK', 'PT Hexindo Adiperkasa Site Sangatta, Kalimantan Timur', 'pengadaan Radio Link & Voip Gateway Hexindo Tango Delta - Warehouse Pama Soulmate, Contract No. 173/AMD/MKN-HEXINDO/V/2024', 'Radio Link & Voip Gateway Hexindo - Warehouse Pama Soulmate 5 Mbps', 'Wanto', 'Project Manager', 'Suryadi', 'PM Sangatta', 'Site Sangatta', 4, true),
('UT Sangatta', 'non-kpc', 'PT UNITED TRACTORS . Tbk', 'PT United Tractors  d/a Site KPCT Crystal, Kalimantan Timur', 'pengadaan Layanan Internet 10 Mbps Dedicated, Surat Penawaran No. 057/MKN-Quot/III/2024  Tanggal 12 Agustus 2024', 'Layanan Internet 10 Mbps Dedicated', 'Wanto', 'Project Manager', 'Mohamad Toyibin', 'Site Operation Head', 'Site KPCT Crystal', 5, true);
--> statement-breakpoint
-- Seed initial devices for KPC Microwave
INSERT INTO `kpi_devices` (`company_id`, `device_name`, `location`, `order_index`)
SELECT c.id, d.name, d.loc, d.idx FROM `kpi_companies` c
JOIN (
  SELECT 'M5 to SURYA' AS name, NULL AS loc, 1 AS idx UNION ALL
  SELECT 'M5 to PTH', NULL, 2 UNION ALL
  SELECT 'M5 to HATARI', NULL, 3 UNION ALL
  SELECT 'M5 to PITJ', NULL, 4 UNION ALL
  SELECT 'SURYA to BINTANG', NULL, 5 UNION ALL
  SELECT 'BINTANG to AB', NULL, 6 UNION ALL
  SELECT 'AB to FARNORTH', NULL, 7 UNION ALL
  SELECT 'HATARI to AB', NULL, 8 UNION ALL
  SELECT 'PTH to LBTT', NULL, 9 UNION ALL
  SELECT 'PTH to PINANG SOUTH', NULL, 10 UNION ALL
  SELECT 'PTH to SAGITARIUS', NULL, 11 UNION ALL
  SELECT 'FARNORTH to 15K', NULL, 12 UNION ALL
  SELECT 'FARNORTH to LIGNITE', NULL, 13 UNION ALL
  SELECT 'LBTT to 15K', NULL, 14 UNION ALL
  SELECT 'SAGITARIUS to LIGNITE', NULL, 15
) d ON 1=1 WHERE c.name = 'KPC Microwave';
--> statement-breakpoint
-- Seed initial devices for KPC TBTS
INSERT INTO `kpi_devices` (`company_id`, `device_name`, `location`, `order_index`)
SELECT c.id, 'Transportable Base Transreceiver Station', 'TBTS', 1 FROM `kpi_companies` c WHERE c.name = 'KPC TBTS';
--> statement-breakpoint
-- Seed initial devices for NAP
INSERT INTO `kpi_devices` (`company_id`, `device_name`, `location`, `order_index`)
SELECT c.id, 'Link MRC Local Loop PT NAP Info Lintas Nusa', 'PT. Liebherr Site Sangatta', 1 FROM `kpi_companies` c WHERE c.name = 'NAP';
--> statement-breakpoint
-- Seed initial devices for Hexindo
INSERT INTO `kpi_devices` (`company_id`, `device_name`, `location`, `order_index`)
SELECT c.id, 'Radio Link & Voip Gateway Hexindo - Warehouse Pama Soulmate 5 Mbps', 'Site Sangatta', 1 FROM `kpi_companies` c WHERE c.name = 'Hexindo';
--> statement-breakpoint
-- Seed initial devices for UT Sangatta
INSERT INTO `kpi_devices` (`company_id`, `device_name`, `location`, `order_index`)
SELECT c.id, 'Layanan Internet 10 Mbps Dedicated', 'Site KPCT Crystal', 1 FROM `kpi_companies` c WHERE c.name = 'UT Sangatta';
--> statement-breakpoint
-- Seed standard Indonesian holidays for 2026
INSERT IGNORE INTO `kpi_holidays` (`holiday_date`, `description`)
VALUES
('2026-01-01', 'Tahun Baru 2026 Masehi'),
('2026-01-16', 'Isra Mi\'raj Nabi Muhammad SAW'),
('2026-02-17', 'Tahun Baru Imlek 2577 Kongzili'),
('2026-03-20', 'Hari Suci Nyepi (Tahun Baru Saka 1948)'),
('2026-03-21', 'Hari Raya Idul Fitri 1447 Hijriah'),
('2026-03-22', 'Hari Raya Idul Fitri 1447 Hijriah (Hari Ke-2)'),
('2026-04-03', 'Wafat Yesus Kristus (Jumat Agung)'),
('2026-05-01', 'Hari Buruh Internasional'),
('2026-05-14', 'Kenaikan Yesus Kristus'),
('2026-05-27', 'Hari Raya Idul Adha 1447 Hijriah'),
('2026-05-31', 'Hari Raya Waisak 2570 BE'),
('2026-06-01', 'Hari Lahir Pancasila'),
('2026-06-16', 'Tahun Baru Islam 1448 Hijriah'),
('2026-08-17', 'Hari Kemerdekaan RI Ke-81'),
('2026-08-25', 'Maulid Nabi Muhammad SAW'),
('2026-12-25', 'Hari Raya Natal');
