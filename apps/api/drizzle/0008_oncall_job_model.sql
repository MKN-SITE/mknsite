-- Migrasi 0008: Oncall Job Model Multi-Teknisi & Supervisor Approval
-- 1. Tambah kolom baru pada ops_telco_forms
-- 2. Buat tabel ops_telco_form_participants, ops_telco_form_signatures, ops_telco_form_approval_history
-- 3. Tambahkan permissions ops_telco.oncall.assign dan ops_telco.oncall.approve
-- 4. Pasang permission ke role ops-telco-supervisor
-- 5. Migrasi data legacy form_type = 'oncall'

ALTER TABLE `ops_telco_forms`
  ADD COLUMN `job_order_no` VARCHAR(100) NULL AFTER `duplicated_from_id`,
  ADD COLUMN `workflow_version` INT NOT NULL DEFAULT 1 AFTER `job_order_no`,
  ADD COLUMN `locked_at` TIMESTAMP NULL AFTER `workflow_version`,
  ADD COLUMN `submitted_at` TIMESTAMP NULL AFTER `locked_at`,
  ADD COLUMN `approved_at` TIMESTAMP NULL AFTER `submitted_at`,
  ADD COLUMN `is_legacy` TINYINT(1) NOT NULL DEFAULT 0 AFTER `approved_at`;
--> statement-breakpoint
ALTER TABLE `ops_telco_forms` ADD INDEX `ops_telco_forms_job_order_no_idx` (`job_order_no`);
--> statement-breakpoint

CREATE TABLE `ops_telco_form_participants` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `form_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `participant_role` VARCHAR(16) NOT NULL DEFAULT 'member',
  `name_snapshot` VARCHAR(160) NOT NULL,
  `kpc_id_snapshot` VARCHAR(32) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `ops_telco_form_participants_form_fk` FOREIGN KEY (`form_id`) REFERENCES `ops_telco_forms`(`id`) ON DELETE CASCADE,
  CONSTRAINT `ops_telco_form_participants_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  UNIQUE INDEX `ops_telco_form_participants_form_user_unique` (`form_id`, `user_id`),
  INDEX `ops_telco_form_participants_form_idx` (`form_id`),
  INDEX `ops_telco_form_participants_user_idx` (`user_id`)
);
--> statement-breakpoint

CREATE TABLE `ops_telco_form_signatures` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `form_id` INT NOT NULL,
  `signer_user_id` INT NOT NULL,
  `signer_type` VARCHAR(24) NOT NULL,
  `workflow_version` INT NOT NULL DEFAULT 1,
  `name_snapshot` VARCHAR(160) NOT NULL,
  `kpc_id_snapshot` VARCHAR(32) NULL,
  `signature_file` VARCHAR(500) NOT NULL,
  `signature_sha256` VARCHAR(64) NOT NULL,
  `signed_payload_hash` VARCHAR(64) NOT NULL,
  `signed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `ops_telco_form_signatures_form_fk` FOREIGN KEY (`form_id`) REFERENCES `ops_telco_forms`(`id`) ON DELETE CASCADE,
  CONSTRAINT `ops_telco_form_signatures_user_fk` FOREIGN KEY (`signer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  UNIQUE INDEX `ops_telco_form_signatures_form_user_version_unique` (`form_id`, `signer_user_id`, `workflow_version`),
  INDEX `ops_telco_form_signatures_form_idx` (`form_id`),
  INDEX `ops_telco_form_signatures_user_idx` (`signer_user_id`)
);
--> statement-breakpoint

CREATE TABLE `ops_telco_form_approval_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `form_id` INT NOT NULL,
  `supervisor_user_id` INT NOT NULL,
  `workflow_version` INT NOT NULL,
  `decision` VARCHAR(32) NOT NULL,
  `note` TEXT NULL,
  `signature_id` INT NULL,
  `decided_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `ops_telco_form_approval_history_form_fk` FOREIGN KEY (`form_id`) REFERENCES `ops_telco_forms`(`id`) ON DELETE CASCADE,
  CONSTRAINT `ops_telco_form_approval_history_supervisor_fk` FOREIGN KEY (`supervisor_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `ops_telco_form_approval_history_signature_fk` FOREIGN KEY (`signature_id`) REFERENCES `ops_telco_form_signatures`(`id`) ON DELETE SET NULL,
  INDEX `ops_telco_form_approval_history_form_idx` (`form_id`),
  INDEX `ops_telco_form_approval_history_supervisor_idx` (`supervisor_user_id`)
);
--> statement-breakpoint

INSERT IGNORE INTO `permissions` (`name`, `slug`) VALUES
('Assign Job Oncall', 'ops_telco.oncall.assign'),
('Approve Form Oncall', 'ops_telco.oncall.approve');
--> statement-breakpoint

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r CROSS JOIN `permissions` p
WHERE r.slug = 'ops-telco-supervisor' AND p.slug IN ('ops_telco.oncall.assign', 'ops_telco.oncall.approve');
--> statement-breakpoint

-- Migrasi data legacy oncall
UPDATE `ops_telco_forms`
SET `is_legacy` = 1,
    `workflow_version` = 1,
    `job_order_no` = COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.jobOrder')), ''), `form_number`)
WHERE `form_type` = 'oncall';
--> statement-breakpoint

INSERT IGNORE INTO `ops_telco_form_participants` (`form_id`, `user_id`, `participant_role`, `name_snapshot`, `kpc_id_snapshot`, `created_at`)
SELECT f.id, f.created_by, 'pic', u.name, u.kpc_id, f.created_at
FROM `ops_telco_forms` f
JOIN `users` u ON f.created_by = u.id
WHERE f.form_type = 'oncall';
