CREATE TABLE IF NOT EXISTS `hr_forms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`form_type` varchar(24) NOT NULL,
	`form_number` varchar(80) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'draft',
	`data` text NOT NULL,
	`created_by` int NOT NULL,
	`duplicated_from_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hr_forms_id` PRIMARY KEY(`id`),
	CONSTRAINT `hr_forms_number_unique` UNIQUE(`form_number`)
);
--> statement-breakpoint
SET @mkn_hr_fk = IF(EXISTS(SELECT 1 FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() AND constraint_name='hr_forms_owner_users_fk'), 'SELECT 1', IF(EXISTS(SELECT 1 FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() AND constraint_name='hr_forms_created_by_users_id_fk'), 'ALTER TABLE `hr_forms` DROP FOREIGN KEY `hr_forms_created_by_users_id_fk`, ADD CONSTRAINT `hr_forms_owner_users_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT', 'ALTER TABLE `hr_forms` ADD CONSTRAINT `hr_forms_owner_users_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT'));
--> statement-breakpoint
PREPARE mkn_stmt FROM @mkn_hr_fk;
--> statement-breakpoint
EXECUTE mkn_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mkn_stmt;
--> statement-breakpoint
SET @mkn_hr_idx = IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='hr_forms' AND index_name='hr_forms_type_idx'), 'SELECT 1', 'CREATE INDEX `hr_forms_type_idx` ON `hr_forms` (`form_type`)');
--> statement-breakpoint
PREPARE mkn_stmt FROM @mkn_hr_idx;
--> statement-breakpoint
EXECUTE mkn_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mkn_stmt;
--> statement-breakpoint
SET @mkn_hr_idx = IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='hr_forms' AND index_name='hr_forms_created_by_idx'), 'SELECT 1', 'CREATE INDEX `hr_forms_created_by_idx` ON `hr_forms` (`created_by`)');
--> statement-breakpoint
PREPARE mkn_stmt FROM @mkn_hr_idx;
--> statement-breakpoint
EXECUTE mkn_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mkn_stmt;
--> statement-breakpoint
SET @mkn_hr_idx = IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='hr_forms' AND index_name='hr_forms_created_at_idx'), 'SELECT 1', 'CREATE INDEX `hr_forms_created_at_idx` ON `hr_forms` (`created_at`)');
--> statement-breakpoint
PREPARE mkn_stmt FROM @mkn_hr_idx;
--> statement-breakpoint
EXECUTE mkn_stmt;
--> statement-breakpoint
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
