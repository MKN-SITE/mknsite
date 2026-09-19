RENAME TABLE `hr_forms` TO `ops_telco_forms`;
--> statement-breakpoint
ALTER TABLE `ops_telco_forms` RENAME INDEX `hr_forms_number_unique` TO `ops_telco_forms_number_unique`;
--> statement-breakpoint
ALTER TABLE `ops_telco_forms` RENAME INDEX `hr_forms_type_idx` TO `ops_telco_forms_type_idx`;
--> statement-breakpoint
ALTER TABLE `ops_telco_forms` RENAME INDEX `hr_forms_created_by_idx` TO `ops_telco_forms_created_by_idx`;
--> statement-breakpoint
ALTER TABLE `ops_telco_forms` RENAME INDEX `hr_forms_created_at_idx` TO `ops_telco_forms_created_at_idx`;
--> statement-breakpoint
ALTER TABLE `ops_telco_forms` DROP FOREIGN KEY `hr_forms_owner_users_fk`, ADD CONSTRAINT `ops_telco_forms_owner_users_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT;
--> statement-breakpoint
INSERT IGNORE INTO `permissions` (`name`, `slug`) VALUES
('Lihat formulir OPS Telco', 'ops_telco.forms.view'),
('Kelola formulir OPS Telco', 'ops_telco.forms.manage');
--> statement-breakpoint
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r CROSS JOIN `permissions` p
WHERE r.slug = 'ops-telco-technician' AND p.slug = 'ops_telco.forms.view';
--> statement-breakpoint
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r CROSS JOIN `permissions` p
WHERE r.slug = 'ops-telco-supervisor' AND p.slug IN ('ops_telco.forms.view', 'ops_telco.forms.manage');
--> statement-breakpoint
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r CROSS JOIN `permissions` p
WHERE r.slug = 'employee-basic' AND p.slug = 'ops_telco.forms.view';
--> statement-breakpoint
DELETE rp FROM `role_permissions` rp
JOIN `roles` r ON rp.role_id = r.id
JOIN `permissions` p ON rp.permission_id = p.id
WHERE r.slug = 'employee-basic' AND p.slug = 'hr.view';
--> statement-breakpoint
UPDATE `menus` SET `is_active` = 0 WHERE `url` = '/portal/hr';
