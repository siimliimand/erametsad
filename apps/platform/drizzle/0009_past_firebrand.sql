CREATE TABLE `partners` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`service_types` text NOT NULL,
	`counties` text,
	`capacity` integer DEFAULT 0 NOT NULL,
	`contact_email` text,
	`contact_phone` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`attachments` text,
	`routed_to` text,
	`status` text DEFAULT 'new' NOT NULL,
	`consent_at` text NOT NULL,
	`form_name` text NOT NULL,
	`page_slug` text,
	`ip_hash` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "service_requests_type_check" CHECK("service_requests"."type" IN ('kava', 'hooldusraie', 'istutamine')),
	CONSTRAINT "service_requests_status_check" CHECK("service_requests"."status" IN ('new', 'routed'))
);
--> statement-breakpoint
CREATE INDEX `service_requests_type_idx` ON `service_requests` (`type`);--> statement-breakpoint
CREATE INDEX `service_requests_status_idx` ON `service_requests` (`status`);--> statement-breakpoint
CREATE INDEX `service_requests_created_at_idx` ON `service_requests` (`created_at`);