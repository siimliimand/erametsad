ALTER TABLE `faq_categories` ADD `active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `faq_items` ADD `short_answer` text;--> statement-breakpoint
ALTER TABLE `faq_items` ADD `active` integer DEFAULT true NOT NULL;