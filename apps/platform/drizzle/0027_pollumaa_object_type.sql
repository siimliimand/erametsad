-- D1 always enforces foreign keys and ignores foreign_keys=OFF inside a
-- batch, and live rows in `bids`, `contracts`, and `autobidders` reference
-- `auctions`, so a plain rebuild of `auctions` would violate the FK on the
-- DROP. The rebuild therefore swaps the referencing tables too: every
-- referenced table name stays occupied until its replacement exists, so no
-- statement orphans a child row under D1's immediate FK enforcement (same
-- recipe as 0014). `auction_rights`, `statistics_snapshots`, and
-- `rights_requests` have no referencing tables, so their plain rebuilds are
-- safe.
ALTER TABLE `auctions` RENAME TO `auctions_old`;--> statement-breakpoint
CREATE TABLE `__new_auctions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`object_type` text NOT NULL,
	`type` text DEFAULT 'open' NOT NULL,
	`is_quick_auction` integer DEFAULT false NOT NULL,
	`end_year` integer,
	`county_id` text,
	`parish_id` text,
	`address` text,
	`coordinates` text,
	`kataster_link` text,
	`metsaregister_link` text,
	`cadastres` text,
	`registry_numbers` text,
	`species` text,
	`logging_types` text,
	`compartments` text,
	`notifications` text,
	`deadlines` text,
	`area_ha` real,
	`volume_m3` real,
	`min_bid_cents` integer NOT NULL,
	`bid_step_cents` integer,
	`reserve_price_cents` integer,
	`final_price_cents` integer,
	`fee_override_percent` integer,
	`vat_included` integer DEFAULT true NOT NULL,
	`description_public` text,
	`description_internal` text,
	`description_secondary` text,
	`alias_email` text,
	`media` text,
	`files` text,
	`package_header` text,
	`package_rows` text,
	`package_columns` text,
	`specialist_id` text,
	`seller_id` text,
	`winning_bid` text,
	`starts_at` text,
	`ends_at` text,
	`scheduled_at` text,
	`activated_at` text,
	`ended_at` text,
	`completed_at` text,
	`appraised_at` text,
	`contract_at` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "auctions_status_check" CHECK("__new_auctions"."status" IN ('draft', 'scheduled', 'active', 'ended', 'appraised', 'unsold', 'contract', 'completed', 'archived')),
	CONSTRAINT "auctions_object_type_check" CHECK("__new_auctions"."object_type" IN ('raieoigus', 'kinnistu', 'kiire', 'pakett', 'pollumaa')),
	CONSTRAINT "auctions_type_check" CHECK("__new_auctions"."type" IN ('open', 'sealed')),
	CONSTRAINT "auctions_prices_check" CHECK("__new_auctions"."min_bid_cents" >= 0 AND "__new_auctions"."bid_step_cents" >= 0 AND "__new_auctions"."reserve_price_cents" >= 0 AND "__new_auctions"."final_price_cents" >= 0)
);--> statement-breakpoint
INSERT INTO `__new_auctions`("id", "title", "slug", "status", "object_type", "type", "is_quick_auction", "end_year", "county_id", "parish_id", "address", "coordinates", "kataster_link", "metsaregister_link", "cadastres", "registry_numbers", "species", "logging_types", "compartments", "notifications", "deadlines", "area_ha", "volume_m3", "min_bid_cents", "bid_step_cents", "reserve_price_cents", "final_price_cents", "fee_override_percent", "vat_included", "description_public", "description_internal", "description_secondary", "alias_email", "media", "files", "package_header", "package_rows", "package_columns", "specialist_id", "seller_id", "winning_bid", "starts_at", "ends_at", "scheduled_at", "activated_at", "ended_at", "completed_at", "appraised_at", "contract_at", "archived_at", "created_at", "updated_at") SELECT "id", "title", "slug", "status", "object_type", "type", "is_quick_auction", "end_year", "county_id", "parish_id", "address", "coordinates", "kataster_link", "metsaregister_link", "cadastres", "registry_numbers", "species", "logging_types", "compartments", "notifications", "deadlines", "area_ha", "volume_m3", "min_bid_cents", "bid_step_cents", "reserve_price_cents", "final_price_cents", "fee_override_percent", "vat_included", "description_public", "description_internal", "description_secondary", "alias_email", "media", "files", "package_header", "package_rows", "package_columns", "specialist_id", "seller_id", "winning_bid", "starts_at", "ends_at", "scheduled_at", "activated_at", "ended_at", "completed_at", "appraised_at", "contract_at", "archived_at", "created_at", "updated_at" FROM `auctions_old`;--> statement-breakpoint
ALTER TABLE `__new_auctions` RENAME TO `auctions`;--> statement-breakpoint
ALTER TABLE `bids` RENAME TO `__old_bids`;--> statement-breakpoint
CREATE TABLE `bids` (
	`id` text PRIMARY KEY NOT NULL,
	`auction_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`type` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`identity_snapshot` text,
	`ip_hash` text,
	`idempotency_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bids_type_check" CHECK("bids"."type" IN ('open', 'sealed')),
	CONSTRAINT "bids_source_check" CHECK("bids"."source" IN ('manual', 'autobidder')),
	CONSTRAINT "bids_status_check" CHECK("bids"."status" IN ('leading', 'outbid', 'won', 'lost', 'pending_approval', 'rejected')),
	CONSTRAINT "bids_amount_check" CHECK("bids"."amount_cents" >= 0)
);--> statement-breakpoint
INSERT INTO `bids`("id", "auction_id", "user_id", "amount_cents", "type", "source", "status", "identity_snapshot", "ip_hash", "idempotency_key", "created_at", "updated_at") SELECT "id", "auction_id", "user_id", "amount_cents", "type", "source", "status", "identity_snapshot", "ip_hash", "idempotency_key", "created_at", "updated_at" FROM `__old_bids`;--> statement-breakpoint
DROP TABLE `__old_bids`;--> statement-breakpoint
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
ALTER TABLE `autobidders` RENAME TO `__old_autobidders`;--> statement-breakpoint
CREATE TABLE `autobidders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`auction_id` text NOT NULL,
	`max_amount_cents` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "autobidders_status_check" CHECK("autobidders"."status" IN ('active', 'paused', 'expired')),
	CONSTRAINT "autobidders_max_amount_check" CHECK("autobidders"."max_amount_cents" >= 0)
);--> statement-breakpoint
INSERT INTO `autobidders`("id", "user_id", "auction_id", "max_amount_cents", "status", "created_at", "updated_at") SELECT "id", "user_id", "auction_id", "max_amount_cents", "status", "created_at", "updated_at" FROM `__old_autobidders`;--> statement-breakpoint
DROP TABLE `__old_autobidders`;--> statement-breakpoint
DROP TABLE `auctions_old`;--> statement-breakpoint
CREATE TABLE `__new_auction_rights` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`object_type` text NOT NULL,
	`granted_by` text NOT NULL,
	`granted_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "auction_rights_object_type_check" CHECK("__new_auction_rights"."object_type" IN ('raieoigus', 'kinnistu', 'kiire', 'pakett', 'pollumaa'))
);--> statement-breakpoint
INSERT INTO `__new_auction_rights`("id", "user_id", "object_type", "granted_by", "granted_at", "revoked_at", "created_at", "updated_at") SELECT "id", "user_id", "object_type", "granted_by", "granted_at", "revoked_at", "created_at", "updated_at" FROM `auction_rights`;--> statement-breakpoint
DROP TABLE `auction_rights`;--> statement-breakpoint
ALTER TABLE `__new_auction_rights` RENAME TO `auction_rights`;--> statement-breakpoint
CREATE TABLE `__new_statistics_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`object_type` text NOT NULL,
	`count` integer NOT NULL,
	`area` real,
	`volume` real,
	`eur_cents` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "statistics_snapshots_object_type_check" CHECK("__new_statistics_snapshots"."object_type" IN ('raieoigus', 'kinnistu', 'kiire', 'pakett', 'pollumaa')),
	CONSTRAINT "statistics_snapshots_values_check" CHECK("__new_statistics_snapshots"."count" >= 0 AND "__new_statistics_snapshots"."area" >= 0 AND "__new_statistics_snapshots"."volume" >= 0 AND "__new_statistics_snapshots"."eur_cents" >= 0)
);--> statement-breakpoint
INSERT INTO `__new_statistics_snapshots`("id", "date", "object_type", "count", "area", "volume", "eur_cents", "created_at", "updated_at") SELECT "id", "date", "object_type", "count", "area", "volume", "eur_cents", "created_at", "updated_at" FROM `statistics_snapshots`;--> statement-breakpoint
DROP TABLE `statistics_snapshots`;--> statement-breakpoint
ALTER TABLE `__new_statistics_snapshots` RENAME TO `statistics_snapshots`;--> statement-breakpoint
CREATE TABLE `__new_rights_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`object_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "rights_requests_status_check" CHECK("__new_rights_requests"."status" IN ('pending', 'approved', 'rejected')),
	CONSTRAINT "rights_requests_object_type_check" CHECK("__new_rights_requests"."object_type" IN ('raieoigus', 'kinnistu', 'kiire', 'pakett', 'pollumaa'))
);--> statement-breakpoint
INSERT INTO `__new_rights_requests`("id", "user_id", "object_type", "status", "created_at", "updated_at") SELECT "id", "user_id", "object_type", "status", "created_at", "updated_at" FROM `rights_requests`;--> statement-breakpoint
DROP TABLE `rights_requests`;--> statement-breakpoint
ALTER TABLE `__new_rights_requests` RENAME TO `rights_requests`;--> statement-breakpoint
CREATE UNIQUE INDEX `auctions_slug_unique` ON `auctions` (`slug`);--> statement-breakpoint
CREATE INDEX `auctions_status_ends_at_idx` ON `auctions` (`status`,`ends_at`);--> statement-breakpoint
CREATE INDEX `auctions_object_type_idx` ON `auctions` (`object_type`);--> statement-breakpoint
CREATE INDEX `auctions_seller_idx` ON `auctions` (`seller_id`);--> statement-breakpoint
CREATE INDEX `bids_auction_created_idx` ON `bids` (`auction_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `bids_idempotency_key_unique` ON `bids` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `bids_user_idx` ON `bids` (`user_id`);--> statement-breakpoint
CREATE INDEX `contracts_lot_idx` ON `contracts` (`lot_id`);--> statement-breakpoint
CREATE INDEX `contracts_template_idx` ON `contracts` (`template_id`);--> statement-breakpoint
CREATE INDEX `autobidders_auction_idx` ON `autobidders` (`auction_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `autobidders_user_auction_active_unique` ON `autobidders` (`user_id`,`auction_id`) WHERE "autobidders"."status" = 'active';--> statement-breakpoint
CREATE INDEX `auction_rights_user_object_idx` ON `auction_rights` (`user_id`,`object_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `statistics_snapshots_date_object_type_unique` ON `statistics_snapshots` (`date`,`object_type`);--> statement-breakpoint
CREATE INDEX `rights_requests_user_object_status_idx` ON `rights_requests` (`user_id`,`object_type`,`status`)