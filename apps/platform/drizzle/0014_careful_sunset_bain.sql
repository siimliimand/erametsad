-- D1 always enforces foreign keys and ignores foreign_keys=OFF inside a
-- batch, and live `contracts` rows reference `contract_templates`, so the
-- plain rebuild would violate the FK on the DROP. The rebuild therefore
-- swaps the referencing table too: every referenced table name stays
-- occupied until its replacement exists, so no statement orphans a child
-- row under D1's immediate FK enforcement.
ALTER TABLE `contract_templates` RENAME TO `contract_templates_old`;--> statement-breakpoint
CREATE TABLE `__new_contract_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`version` text NOT NULL,
	`placeholders` text,
	`docx_file_id` text,
	`source_content` text,
	`source_format` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "contract_templates_type_check" CHECK("__new_contract_templates"."type" IN ('framework', 'auction')),
	CONSTRAINT "contract_templates_source_format_check" CHECK("__new_contract_templates"."source_format" IN ('html', 'txt'))
);
--> statement-breakpoint
INSERT INTO `__new_contract_templates`("id", "name", "type", "version", "placeholders", "docx_file_id", "source_content", "source_format", "active", "created_at", "updated_at") SELECT "id", "name", "type", "version", "placeholders", "docx_file_id", NULL, NULL, "active", "created_at", "updated_at" FROM `contract_templates_old`;--> statement-breakpoint
ALTER TABLE `__new_contract_templates` RENAME TO `contract_templates`;--> statement-breakpoint
ALTER TABLE `contracts` RENAME TO `__old_contracts`;--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`lot_id` text NOT NULL,
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
	CONSTRAINT "contracts_status_check" CHECK("contracts"."status" IN ('prepared', 'sent', 'signed', 'voided'))
);--> statement-breakpoint
INSERT INTO `contracts`("id", "template_id", "lot_id", "status", "signed_at", "signed_by", "content_hash", "rendered_html", "created_at", "updated_at") SELECT "id", "template_id", "lot_id", "status", "signed_at", "signed_by", "content_hash", "rendered_html", "created_at", "updated_at" FROM `__old_contracts`;--> statement-breakpoint
DROP TABLE `__old_contracts`;--> statement-breakpoint
DROP TABLE `contract_templates_old`;--> statement-breakpoint
CREATE INDEX `contract_templates_type_active_idx` ON `contract_templates` (`type`,`active`);--> statement-breakpoint
CREATE INDEX `contracts_lot_idx` ON `contracts` (`lot_id`);--> statement-breakpoint
CREATE INDEX `contracts_template_idx` ON `contracts` (`template_id`);
