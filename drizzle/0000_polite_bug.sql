CREATE TABLE `answers` (
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_index` integer,
	`marked_for_review` integer DEFAULT false NOT NULL,
	`time_spent_ms` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`attempt_id`, `question_id`),
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`submitted_at` integer,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`score` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`test_id`) REFERENCES `tests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempts_test_idx` ON `attempts` (`test_id`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`section_id` text NOT NULL,
	`topic` text DEFAULT '' NOT NULL,
	`difficulty` text DEFAULT 'medium' NOT NULL,
	`stem` text NOT NULL,
	`options` text NOT NULL,
	`correct_index` integer,
	`is_bonus` integer DEFAULT false NOT NULL,
	`key_status` text DEFAULT 'unofficial' NOT NULL,
	`explanation` text DEFAULT '' NOT NULL,
	`source_ref` text,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`paper_id` text,
	`status` text DEFAULT 'published' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`content_hash` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `questions_section_idx` ON `questions` (`section_id`,`status`);--> statement-breakpoint
CREATE INDEX `questions_hash_idx` ON `questions` (`content_hash`);--> statement-breakpoint
CREATE TABLE `tests` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'full' NOT NULL,
	`pattern` text NOT NULL,
	`duration_sec` integer NOT NULL,
	`question_ids` text NOT NULL,
	`is_template` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
