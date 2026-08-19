CREATE TABLE `contestants` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `participant_number` text NOT NULL,
  `student_id` text NOT NULL,
  `category` text NOT NULL,
  `thai_name` text DEFAULT '' NOT NULL,
  `thai_nickname` text DEFAULT '' NOT NULL,
  `english_name` text NOT NULL,
  `english_nickname` text DEFAULT '' NOT NULL,
  `department` text DEFAULT '' NOT NULL,
  `phone` text DEFAULT '' NOT NULL,
  `line_id` text DEFAULT '' NOT NULL,
  `instagram` text DEFAULT '' NOT NULL,
  `available_dates` text DEFAULT '' NOT NULL,
  `review_flags` text DEFAULT '' NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contestants_participant_number_unique` ON `contestants` (`participant_number`);
--> statement-breakpoint
CREATE UNIQUE INDEX `contestants_student_category_unique` ON `contestants` (`student_id`,`category`);
--> statement-breakpoint
CREATE TABLE `contestant_import_backups` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` text NOT NULL,
  `row_count` integer NOT NULL,
  `snapshot_json` text NOT NULL
);