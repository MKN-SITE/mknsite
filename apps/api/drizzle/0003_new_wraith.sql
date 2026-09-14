CREATE TABLE `hr_forms` (
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
ALTER TABLE `hr_forms` ADD CONSTRAINT `hr_forms_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `hr_forms_type_idx` ON `hr_forms` (`form_type`);--> statement-breakpoint
CREATE INDEX `hr_forms_created_by_idx` ON `hr_forms` (`created_by`);--> statement-breakpoint
CREATE INDEX `hr_forms_created_at_idx` ON `hr_forms` (`created_at`);