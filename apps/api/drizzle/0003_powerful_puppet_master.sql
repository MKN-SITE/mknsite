CREATE TABLE `divisions` (
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
ALTER TABLE `users` ADD `division` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_url` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `last_login_at` timestamp;--> statement-breakpoint
CREATE INDEX `users_division_idx` ON `users` (`division`);