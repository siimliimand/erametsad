PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
INSERT INTO `__new_contract_templates`("id", "name", "type", "version", "placeholders", "docx_file_id", "source_content", "source_format", "active", "created_at", "updated_at") SELECT "id", "name", "type", "version", "placeholders", "docx_file_id", "source_content", "source_format", "active", "created_at", "updated_at" FROM `contract_templates`;--> statement-breakpoint
DROP TABLE `contract_templates`;--> statement-breakpoint
ALTER TABLE `__new_contract_templates` RENAME TO `contract_templates`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `contract_templates_type_active_idx` ON `contract_templates` (`type`,`active`);