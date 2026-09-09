PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_service_requests` (
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
	CONSTRAINT "service_requests_type_check" CHECK("__new_service_requests"."type" IN ('kava', 'hooldusraie', 'istutamine')),
	CONSTRAINT "service_requests_status_check" CHECK("__new_service_requests"."status" IN ('new', 'routed', 'teostatud', 'suletud'))
);
--> statement-breakpoint
INSERT INTO `__new_service_requests`("id", "type", "payload", "attachments", "routed_to", "status", "consent_at", "form_name", "page_slug", "ip_hash", "created_at", "updated_at") SELECT "id", "type", "payload", "attachments", "routed_to", "status", "consent_at", "form_name", "page_slug", "ip_hash", "created_at", "updated_at" FROM `service_requests`;--> statement-breakpoint
DROP TABLE `service_requests`;--> statement-breakpoint
ALTER TABLE `__new_service_requests` RENAME TO `service_requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `service_requests_type_idx` ON `service_requests` (`type`);--> statement-breakpoint
CREATE INDEX `service_requests_status_idx` ON `service_requests` (`status`);--> statement-breakpoint
CREATE INDEX `service_requests_created_at_idx` ON `service_requests` (`created_at`);