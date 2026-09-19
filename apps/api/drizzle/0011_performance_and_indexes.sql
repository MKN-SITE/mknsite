ALTER TABLE `ops_telco_forms` ADD COLUMN `leave_start_date` DATE NULL AFTER `job_order_no`;
--> statement-breakpoint
ALTER TABLE `ops_telco_forms` ADD COLUMN `leave_end_date` DATE NULL AFTER `leave_start_date`;
--> statement-breakpoint
ALTER TABLE `ops_telco_forms` ADD INDEX `ops_telco_forms_type_status_idx` (`form_type`, `status`, `created_at`);
--> statement-breakpoint
ALTER TABLE `ops_telco_forms` ADD INDEX `ops_telco_forms_leave_dates_idx` (`form_type`, `created_by`, `leave_start_date`, `leave_end_date`);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD INDEX `audit_logs_action_created_idx` (`action`, `created_at`);
--> statement-breakpoint
ALTER TABLE `auth_session` ADD INDEX `auth_session_expires_at_idx` (`expires_at`);
--> statement-breakpoint
UPDATE `ops_telco_forms`
SET
  `leave_start_date` = STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.leaveStartDate')), '%Y-%m-%d'),
  `leave_end_date` = STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.leaveEndDate')), '%Y-%m-%d')
WHERE `form_type` = 'cuti'
  AND JSON_VALID(`data`) = 1
  AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.leaveStartDate')) IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.leaveEndDate')) IS NOT NULL;
