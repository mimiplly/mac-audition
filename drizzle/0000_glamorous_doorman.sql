CREATE TABLE `scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`judge_id` integer NOT NULL,
	`participant_number` text NOT NULL,
	`vocal` integer NOT NULL,
	`diction` integer NOT NULL,
	`musical` integer NOT NULL,
	`expression` integer NOT NULL,
	`stage` integer NOT NULL,
	`lyrics` integer NOT NULL,
	`presentation` integer NOT NULL,
	`extra_a` integer NOT NULL DEFAULT 0,
	`extra_b` integer NOT NULL DEFAULT 0,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `judge_participant_unique` ON `scores` (`judge_id`,`participant_number`);