-- Multi-user support.
--
-- `attempts.user_id` is added as a nullable column and backfilled to the
-- legacy `user1` account. New rows always set an owner, and the application
-- layer treats the column as NOT NULL. SQLite cannot add a NOT NULL column
-- with an FK to an existing table without rebuilding it, and rebuilding would
-- cascade-delete answers — so this keeps existing installs safe.
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
-- Legacy owner for any attempts made before accounts existed.
INSERT INTO `users` (`id`, `username`, `display_name`, `password_hash`, `role`, `is_active`, `created_at`)
VALUES (
	'00000000-0000-4000-8000-000000000001',
	'user1',
	'User 1',
	'scrypt:abc3a2295fa142ff1a86b063458e476a:8bfbdaf76d2da304982f35794fa82265ba69084021ac1c16e8a6b5c48fdde1668e12d1f0a209d5faa62743cd5ff48183f7da4d78b480910930882ed3b59650e0',
	'user',
	1,
	CAST(strftime('%s','now') AS INTEGER) * 1000
);
--> statement-breakpoint
ALTER TABLE `attempts` ADD `user_id` text REFERENCES users(id);
--> statement-breakpoint
UPDATE `attempts`
SET `user_id` = '00000000-0000-4000-8000-000000000001'
WHERE `user_id` IS NULL;
--> statement-breakpoint
CREATE INDEX `attempts_user_started_idx` ON `attempts` (`user_id`,`started_at`);
