ALTER TABLE `oncall_crew_members` ADD COLUMN `display_name` VARCHAR(100) NULL;
--> statement-breakpoint
ALTER TABLE `oncall_schedule_slots` ADD COLUMN `dates_json` TEXT NULL;
