CREATE TABLE `account_aliases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`alias_type` varchar(24) NOT NULL,
	`normalized_value` varchar(191) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_aliases_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_aliases_normalized_unique` UNIQUE(`normalized_value`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `kpc_id` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `start_date` date;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_kpc_id_unique` UNIQUE(`kpc_id`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);--> statement-breakpoint
ALTER TABLE `account_aliases` ADD CONSTRAINT `account_aliases_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `account_aliases_user_idx` ON `account_aliases` (`user_id`);--> statement-breakpoint
CREATE INDEX `account_aliases_type_idx` ON `account_aliases` (`alias_type`);--> statement-breakpoint
INSERT INTO `account_aliases` (`user_id`, `alias_type`, `normalized_value`) SELECT `id`, 'email', LOWER(`email`) FROM `users`;