CREATE TABLE `rights_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`object_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "rights_requests_status_check" CHECK("rights_requests"."status" IN ('pending', 'approved', 'rejected')),
	CONSTRAINT "rights_requests_object_type_check" CHECK("rights_requests"."object_type" IN ('raieoigus', 'kinnistu', 'kiire', 'pakett'))
);
--> statement-breakpoint
CREATE INDEX `rights_requests_user_object_status_idx` ON `rights_requests` (`user_id`,`object_type`,`status`);