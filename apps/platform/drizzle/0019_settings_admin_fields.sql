ALTER TABLE `settings` ADD `org_vat_code` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `support_email` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `support_phone` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `alias_domain` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `quick_auction_fee_percent` integer CONSTRAINT "settings_quick_auction_fee_percent_check" CHECK (`settings`.`quick_auction_fee_percent` >= 0 AND `settings`.`quick_auction_fee_percent` <= 10);--> statement-breakpoint
ALTER TABLE `settings` ADD `minimum_fee_cents` integer DEFAULT 0 NOT NULL CONSTRAINT "settings_minimum_fee_cents_check" CHECK (`settings`.`minimum_fee_cents` >= 0);--> statement-breakpoint
ALTER TABLE `settings` ADD `autobidder_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `min_auction_duration_hours` integer DEFAULT 1 NOT NULL;