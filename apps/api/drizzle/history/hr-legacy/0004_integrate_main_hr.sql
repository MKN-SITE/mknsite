-- Reconcile main installations that previously used db:push, as well as clean installs.
CREATE TABLE IF NOT EXISTS `divisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `divisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `divisions_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `menus` MODIFY COLUMN `icon` text;--> statement-breakpoint
SET @mkn_ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'division'), 'SELECT 1', 'ALTER TABLE `users` ADD `division` varchar(100)');--> statement-breakpoint
PREPARE mkn_stmt FROM @mkn_ddl;--> statement-breakpoint
EXECUTE mkn_stmt;--> statement-breakpoint
DEALLOCATE PREPARE mkn_stmt;--> statement-breakpoint
SET @mkn_ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'avatar_url'), 'SELECT 1', 'ALTER TABLE `users` ADD `avatar_url` varchar(500)');--> statement-breakpoint
PREPARE mkn_stmt FROM @mkn_ddl;--> statement-breakpoint
EXECUTE mkn_stmt;--> statement-breakpoint
DEALLOCATE PREPARE mkn_stmt;--> statement-breakpoint
SET @mkn_ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'last_login_at'), 'SELECT 1', 'ALTER TABLE `users` ADD `last_login_at` timestamp NULL');--> statement-breakpoint
PREPARE mkn_stmt FROM @mkn_ddl;--> statement-breakpoint
EXECUTE mkn_stmt;--> statement-breakpoint
DEALLOCATE PREPARE mkn_stmt;--> statement-breakpoint
SET @mkn_ddl = IF(EXISTS(SELECT 1 FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND constraint_name = 'hr_forms_created_by_users_id_fk'), 'ALTER TABLE `hr_forms` DROP FOREIGN KEY `hr_forms_created_by_users_id_fk`, ADD CONSTRAINT `hr_forms_owner_users_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT', 'SELECT 1');--> statement-breakpoint
PREPARE mkn_stmt FROM @mkn_ddl;--> statement-breakpoint
EXECUTE mkn_stmt;--> statement-breakpoint
DEALLOCATE PREPARE mkn_stmt;--> statement-breakpoint
SET @mkn_ddl = IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'users_division_idx'), 'SELECT 1', 'CREATE INDEX `users_division_idx` ON `users` (`division`)');--> statement-breakpoint
PREPARE mkn_stmt FROM @mkn_ddl;--> statement-breakpoint
EXECUTE mkn_stmt;--> statement-breakpoint
DEALLOCATE PREPARE mkn_stmt;
--> statement-breakpoint
-- One-time permission catalogue upgrade. Never creates menus or accounts.
SET @mkn_new_telco = NOT EXISTS(SELECT 1 FROM permissions WHERE slug = 'ops_telco.schedule.view');
--> statement-breakpoint
SET @mkn_new_supervisor = NOT EXISTS(SELECT 1 FROM roles WHERE slug = 'ops-telco-supervisor');
--> statement-breakpoint
INSERT IGNORE INTO permissions (name, slug) VALUES
('Lihat penugasan job Telco', 'ops_telco.job_assignment.view'),
('Kelola jadwal oncall Telco', 'ops_telco.schedule.manage'),
('Lihat Form PTO Telco', 'ops_telco.pto.view'),
('Lihat jadwal oncall Telco', 'ops_telco.schedule.view'),
('Lihat auto report WAG Telco', 'ops_telco.wag_report.view'),
('Lihat estimasi dan quotation Telco', 'ops_telco.estimate.view'),
('Lihat dokumentasi pekerjaan Telco', 'ops_telco.documentation.view');
--> statement-breakpoint
-- On an empty installation seed creates all roles and their default grants.
INSERT IGNORE INTO roles (name, slug)
SELECT 'OPS Telco Supervisor', 'ops-telco-supervisor'
WHERE EXISTS(SELECT 1 FROM roles WHERE slug = 'ops-telco');
--> statement-breakpoint
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE (r.slug = 'ops-telco-supervisor' AND @mkn_new_supervisor
AND p.slug IN ('dashboard.view', 'ops_telco.view', 'ops_telco.manage', 'ops_telco.job_assignment.view', 'ops_telco.schedule.manage', 'ops_telco.pto.view', 'ops_telco.schedule.view', 'ops_telco.wag_report.view', 'ops_telco.estimate.view', 'ops_telco.documentation.view'))
OR (@mkn_new_telco AND r.slug IN ('ops-telco', 'manager')
AND EXISTS(SELECT 1 FROM role_permissions rp JOIN permissions parent ON parent.id = rp.permission_id WHERE rp.role_id = r.id AND parent.slug = 'ops_telco.view')
AND (p.slug IN ('ops_telco.schedule.view', 'ops_telco.wag_report.view', 'ops_telco.estimate.view', 'ops_telco.documentation.view')
OR (r.slug = 'manager' AND p.slug IN ('ops_telco.job_assignment.view', 'ops_telco.schedule.manage', 'ops_telco.pto.view'))));
