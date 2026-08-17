CREATE TABLE `entry` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`week` text NOT NULL,
	`mode` text DEFAULT 'full' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`lifescore` integer,
	`sat_work` integer,
	`sat_leisure` integer,
	`sat_self` integer,
	`gap_reason` text,
	`identity` text,
	`vision` text,
	`aar_better` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`part1_at` integer,
	`submitted_at` integer,
	`late` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `entry_week_idx` ON `entry` (`week`);--> statement-breakpoint
CREATE UNIQUE INDEX `entry_person_week` ON `entry` (`person_id`,`week`);--> statement-breakpoint
CREATE TABLE `goal` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`label` text NOT NULL,
	`sort` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `goal_person_idx` ON `goal` (`person_id`);--> statement-breakpoint
CREATE TABLE `item` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`sort` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `item_entry_idx` ON `item` (`entry_id`,`kind`);--> statement-breakpoint
CREATE TABLE `partner_note` (
	`id` text PRIMARY KEY NOT NULL,
	`week` text NOT NULL,
	`author_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_note_unique` ON `partner_note` (`week`,`author_id`);--> statement-breakpoint
CREATE TABLE `person` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`partner_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `person_email_unique` ON `person` (`email`);--> statement-breakpoint
CREATE TABLE `prio_review` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`prio_id` text NOT NULL,
	`result` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prio_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prio_review_unique` ON `prio_review` (`entry_id`,`prio_id`);--> statement-breakpoint
CREATE TABLE `value` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`sort` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `value_person_idx` ON `value` (`person_id`,`active`);--> statement-breakpoint
CREATE TABLE `value_check` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`value_id` text NOT NULL,
	`score` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`value_id`) REFERENCES `value`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `value_check_unique` ON `value_check` (`entry_id`,`value_id`);