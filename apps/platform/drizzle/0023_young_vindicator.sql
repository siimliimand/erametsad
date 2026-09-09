CREATE TABLE `notification_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`channel` text NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "notification_templates_channel_check" CHECK("notification_templates"."channel" IN ('email', 'sms')),
	CONSTRAINT "notification_templates_version_check" CHECK("notification_templates"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX `notification_templates_event_channel_idx` ON `notification_templates` (`event`,`channel`);--> statement-breakpoint
CREATE UNIQUE INDEX `notification_templates_active_idx` ON `notification_templates` (`event`,`channel`) WHERE active = 1;