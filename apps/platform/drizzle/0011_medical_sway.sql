CREATE TABLE `page_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`type` text NOT NULL,
	`ordinal` integer NOT NULL,
	`config_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "page_blocks_type_check" CHECK("page_blocks"."type" IN ('hero', 'text', 'cards', 'accordion', 'form', 'ticker', 'stats', 'cta', 'testimonials', 'faq'))
);
--> statement-breakpoint
CREATE INDEX `page_blocks_page_ordinal_idx` ON `page_blocks` (`page_id`,`ordinal`);--> statement-breakpoint
CREATE TABLE `page_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`version` integer NOT NULL,
	`label` text,
	`snapshot_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_versions_page_version_unique` ON `page_versions` (`page_id`,`version`);--> statement-breakpoint
ALTER TABLE `audit_entries` ADD `prev_hash` text;--> statement-breakpoint
ALTER TABLE `audit_entries` ADD `hash` text;