CREATE TABLE `consent_log` (
	`id` text PRIMARY KEY NOT NULL,
	`choice` text NOT NULL,
	`categories` text,
	`ip_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "consent_log_choice_check" CHECK("consent_log"."choice" IN ('accepted', 'rejected', 'custom'))
);
