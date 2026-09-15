CREATE TABLE `__new_contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`lot_id` text,
	`status` text DEFAULT 'prepared' NOT NULL,
	`signed_at` text,
	`signed_by` text,
	`content_hash` text,
	`rendered_html` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `contract_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`signed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "contracts_status_check" CHECK("__new_contracts"."status" IN ('prepared', 'sent', 'signed', 'voided'))
);
--> statement-breakpoint
INSERT INTO `__new_contracts`("id", "template_id", "lot_id", "status", "signed_at", "signed_by", "content_hash", "rendered_html", "created_at", "updated_at") SELECT "id", "template_id", "lot_id", "status", "signed_at", "signed_by", "content_hash", "rendered_html", "created_at", "updated_at" FROM `contracts`;
--> statement-breakpoint
DROP TABLE `contracts`;
--> statement-breakpoint
ALTER TABLE `__new_contracts` RENAME TO `contracts`;
--> statement-breakpoint
CREATE INDEX `contracts_lot_idx` ON `contracts` (`lot_id`);
--> statement-breakpoint
CREATE INDEX `contracts_template_idx` ON `contracts` (`template_id`);
