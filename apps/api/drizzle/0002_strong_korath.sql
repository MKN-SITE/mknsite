CREATE TABLE `menus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(100) NOT NULL,
	`icon` varchar(100),
	`description` varchar(255),
	`url` varchar(500),
	`required_permission` varchar(140),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` int NOT NULL DEFAULT 1,
	`badge_count` int DEFAULT 0,
	`badge_color` varchar(20) DEFAULT 'orange',
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menus_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `auth_user` MODIFY COLUMN `mkn_user_id` int;--> statement-breakpoint
ALTER TABLE `menus` ADD CONSTRAINT `menus_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `menus_sort_order_idx` ON `menus` (`sort_order`);--> statement-breakpoint
CREATE INDEX `menus_is_active_idx` ON `menus` (`is_active`);--> statement-breakpoint
CREATE INDEX `menus_required_permission_idx` ON `menus` (`required_permission`);