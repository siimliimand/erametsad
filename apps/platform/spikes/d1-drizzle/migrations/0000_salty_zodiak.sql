CREATE TABLE `auctions` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`starting_price_cents` integer NOT NULL,
	`current_price_cents` integer NOT NULL,
	`ends_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "auctions_status_check" CHECK("auctions"."status" IN ('draft', 'scheduled', 'active', 'ended', 'unsold', 'contract', 'completed', 'archived')),
	CONSTRAINT "auctions_prices_check" CHECK("auctions"."starting_price_cents" >= 0 AND "auctions"."current_price_cents" >= "auctions"."starting_price_cents")
);
--> statement-breakpoint
CREATE INDEX `auctions_seller_idx` ON `auctions` (`seller_id`);--> statement-breakpoint
CREATE TABLE `bids` (
	`id` text PRIMARY KEY NOT NULL,
	`auction_id` text NOT NULL,
	`bidder_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bidder_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bids_amount_check" CHECK("bids"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `bids_auction_idx` ON `bids` (`auction_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "users_status_check" CHECK("users"."status" IN ('active', 'suspended'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);