CREATE TABLE `maintenance_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`scope` text DEFAULT 'portal' NOT NULL,
	`created_by` text,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "maintenance_windows_scope_check" CHECK("maintenance_windows"."scope" IN ('portal', 'admin', 'all')),
	CONSTRAINT "maintenance_windows_range_check" CHECK("maintenance_windows"."ends_at" > "maintenance_windows"."starts_at")
);
--> statement-breakpoint
CREATE INDEX `maintenance_windows_starts_idx` ON `maintenance_windows` (`starts_at`);