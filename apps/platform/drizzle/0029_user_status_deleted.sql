-- D1 always enforces foreign keys and ignores foreign_keys=OFF inside a
-- batch, and fifteen live tables reference `users`, so a plain rebuild of
-- `users` would violate the FK on the DROP. The rebuild therefore swaps
-- every referencing table too: each referenced table name stays occupied
-- until its replacement exists, so no statement orphans a child row under
-- D1's immediate FK enforcement (same recipe as 0014). The `auctions`
-- subtree is swapped before `auctions_old` is dropped because `bids`,
-- `contracts`, and `autobidders` reference it.
ALTER TABLE `users` RENAME TO `users_old`;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`role` text DEFAULT 'guest' NOT NULL,
	`phone` text,
	`status` text DEFAULT 'active' NOT NULL,
	`auth_method` text DEFAULT 'password' NOT NULL,
	`isikukood_encrypted` text,
	`isikukood_iv` text,
	`isikukood_auth_tag` text,
	`isikukood_hash` text,
	`password_hash` text,
	`password_salt` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "users_role_check" CHECK("__new_users"."role" IN ('guest', 'private', 'company', 'seller', 'specialist', 'admin', 'superadmin')),
	CONSTRAINT "users_status_check" CHECK("__new_users"."status" IN ('active', 'suspended', 'deleted')),
	CONSTRAINT "users_auth_method_check" CHECK("__new_users"."auth_method" IN ('eid', 'password'))
);--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "name", "role", "phone", "status", "auth_method", "isikukood_encrypted", "isikukood_iv", "isikukood_auth_tag", "isikukood_hash", "password_hash", "password_salt", "created_at", "updated_at") SELECT "id", "email", "name", "role", "phone", "status", "auth_method", "isikukood_encrypted", "isikukood_iv", "isikukood_auth_tag", "isikukood_hash", "password_hash", "password_salt", "created_at", "updated_at" FROM `users_old`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
ALTER TABLE `auctions` RENAME TO `auctions_old`;--> statement-breakpoint
CREATE TABLE `auctions` (
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
	`cut_deadline_year` integer,
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
	CONSTRAINT "auctions_status_check" CHECK("auctions"."status" IN ('draft', 'scheduled', 'active', 'ended', 'appraised', 'unsold', 'contract', 'completed', 'archived')),
	CONSTRAINT "auctions_object_type_check" CHECK("auctions"."object_type" IN ('raieoigus', 'kinnistu', 'kiire', 'pakett', 'pollumaa')),
	CONSTRAINT "auctions_type_check" CHECK("auctions"."type" IN ('open', 'sealed')),
	CONSTRAINT "auctions_prices_check" CHECK("auctions"."min_bid_cents" >= 0 AND "auctions"."bid_step_cents" >= 0 AND "auctions"."reserve_price_cents" >= 0 AND "auctions"."final_price_cents" >= 0)
);--> statement-breakpoint
INSERT INTO `auctions`("id", "title", "slug", "status", "object_type", "type", "is_quick_auction", "end_year", "county_id", "parish_id", "address", "coordinates", "kataster_link", "metsaregister_link", "cadastres", "registry_numbers", "species", "logging_types", "compartments", "notifications", "deadlines", "area_ha", "volume_m3", "cut_deadline_year", "min_bid_cents", "bid_step_cents", "reserve_price_cents", "final_price_cents", "fee_override_percent", "vat_included", "description_public", "description_internal", "description_secondary", "alias_email", "media", "files", "package_header", "package_rows", "package_columns", "specialist_id", "seller_id", "winning_bid", "starts_at", "ends_at", "scheduled_at", "activated_at", "ended_at", "completed_at", "appraised_at", "contract_at", "archived_at", "created_at", "updated_at") SELECT "id", "title", "slug", "status", "object_type", "type", "is_quick_auction", "end_year", "county_id", "parish_id", "address", "coordinates", "kataster_link", "metsaregister_link", "cadastres", "registry_numbers", "species", "logging_types", "compartments", "notifications", "deadlines", "area_ha", "volume_m3", "cut_deadline_year", "min_bid_cents", "bid_step_cents", "reserve_price_cents", "final_price_cents", "fee_override_percent", "vat_included", "description_public", "description_internal", "description_secondary", "alias_email", "media", "files", "package_header", "package_rows", "package_columns", "specialist_id", "seller_id", "winning_bid", "starts_at", "ends_at", "scheduled_at", "activated_at", "ended_at", "completed_at", "appraised_at", "contract_at", "archived_at", "created_at", "updated_at" FROM `auctions_old`;--> statement-breakpoint
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
ALTER TABLE `sessions` RENAME TO `__old_sessions`;--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`profile_id` text,
	`token_family` text NOT NULL,
	`access_token_hash` text NOT NULL,
	`refresh_token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sessions_role_check" CHECK("sessions"."role" IN ('guest', 'private', 'company', 'seller', 'specialist', 'admin', 'superadmin'))
);--> statement-breakpoint
INSERT INTO `sessions`("id", "user_id", "role", "profile_id", "token_family", "access_token_hash", "refresh_token_hash", "expires_at", "revoked_at", "created_at", "updated_at", "impersonated_by") SELECT "id", "user_id", "role", "profile_id", "token_family", "access_token_hash", "refresh_token_hash", "expires_at", "revoked_at", "created_at", "updated_at", "impersonated_by" FROM `__old_sessions`;--> statement-breakpoint
DROP TABLE `__old_sessions`;--> statement-breakpoint
ALTER TABLE `auction_rights` RENAME TO `__old_auction_rights`;--> statement-breakpoint
CREATE TABLE `auction_rights` (
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
	CONSTRAINT "auction_rights_object_type_check" CHECK("auction_rights"."object_type" IN ('raieoigus', 'kinnistu', 'kiire', 'pakett', 'pollumaa'))
);--> statement-breakpoint
INSERT INTO `auction_rights`("id", "user_id", "object_type", "granted_by", "granted_at", "revoked_at", "created_at", "updated_at") SELECT "id", "user_id", "object_type", "granted_by", "granted_at", "revoked_at", "created_at", "updated_at" FROM `__old_auction_rights`;--> statement-breakpoint
DROP TABLE `__old_auction_rights`;--> statement-breakpoint
ALTER TABLE `rights_requests` RENAME TO `__old_rights_requests`;--> statement-breakpoint
CREATE TABLE `rights_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`object_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "rights_requests_status_check" CHECK("rights_requests"."status" IN ('pending', 'approved', 'rejected')),
	CONSTRAINT "rights_requests_object_type_check" CHECK("rights_requests"."object_type" IN ('raieoigus', 'kinnistu', 'kiire', 'pakett', 'pollumaa'))
);--> statement-breakpoint
INSERT INTO `rights_requests`("id", "user_id", "object_type", "status", "created_at", "updated_at") SELECT "id", "user_id", "object_type", "status", "created_at", "updated_at" FROM `__old_rights_requests`;--> statement-breakpoint
DROP TABLE `__old_rights_requests`;--> statement-breakpoint
ALTER TABLE `profiles` RENAME TO `__old_profiles`;--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`approval_status` text DEFAULT 'pending' NOT NULL,
	`user_id` text NOT NULL,
	`company_name` text,
	`company_reg_code` text,
	`display_name` text,
	`phone` text,
	`terms_consent_at` text,
	`privacy_consent_at` text,
	`marketing_consent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`notification_preferences` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "profiles_type_check" CHECK("profiles"."type" IN ('private', 'company')),
	CONSTRAINT "profiles_approval_status_check" CHECK("profiles"."approval_status" IN ('pending', 'approved', 'rejected'))
);--> statement-breakpoint
INSERT INTO `profiles`("id", "type", "approval_status", "user_id", "company_name", "company_reg_code", "display_name", "phone", "terms_consent_at", "privacy_consent_at", "marketing_consent_at", "created_at", "updated_at", "notification_preferences") SELECT "id", "type", "approval_status", "user_id", "company_name", "company_reg_code", "display_name", "phone", "terms_consent_at", "privacy_consent_at", "marketing_consent_at", "created_at", "updated_at", "notification_preferences" FROM `__old_profiles`;--> statement-breakpoint
DROP TABLE `__old_profiles`;--> statement-breakpoint
ALTER TABLE `audit_entries` RENAME TO `__old_audit_entries`;--> statement-breakpoint
CREATE TABLE `audit_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`before` text,
	`after` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`prev_hash` text,
	`hash` text,
	`reason` text,
	`session_id` text,
	`ip_hash` text,
	`user_agent` text,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `audit_entries`("id", "actor_id", "action", "entity_type", "entity_id", "before", "after", "created_at", "updated_at", "prev_hash", "hash", "reason", "session_id", "ip_hash", "user_agent") SELECT "id", "actor_id", "action", "entity_type", "entity_id", "before", "after", "created_at", "updated_at", "prev_hash", "hash", "reason", "session_id", "ip_hash", "user_agent" FROM `__old_audit_entries`;--> statement-breakpoint
DROP TABLE `__old_audit_entries`;--> statement-breakpoint
ALTER TABLE `maintenance_windows` RENAME TO `__old_maintenance_windows`;--> statement-breakpoint
CREATE TABLE `maintenance_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`scope` text DEFAULT 'portal' NOT NULL,
	`created_by` text,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "maintenance_windows_scope_check" CHECK("maintenance_windows"."scope" IN ('portal', 'admin', 'all')),
	CONSTRAINT "maintenance_windows_range_check" CHECK("maintenance_windows"."ends_at" > "maintenance_windows"."starts_at")
);--> statement-breakpoint
INSERT INTO `maintenance_windows`("id", "starts_at", "ends_at", "scope", "created_by", "note", "created_at", "updated_at") SELECT "id", "starts_at", "ends_at", "scope", "created_by", "note", "created_at", "updated_at" FROM `__old_maintenance_windows`;--> statement-breakpoint
DROP TABLE `__old_maintenance_windows`;--> statement-breakpoint
ALTER TABLE `password_reset_tokens` RENAME TO `__old_password_reset_tokens`;--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `password_reset_tokens`("id", "user_id", "token_hash", "expires_at", "used_at", "created_at", "updated_at") SELECT "id", "user_id", "token_hash", "expires_at", "used_at", "created_at", "updated_at" FROM `__old_password_reset_tokens`;--> statement-breakpoint
DROP TABLE `__old_password_reset_tokens`;--> statement-breakpoint
ALTER TABLE `company_access_requests` RENAME TO `__old_company_access_requests`;--> statement-breakpoint
CREATE TABLE `company_access_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`reg_code` text NOT NULL,
	`company_name` text,
	`requester_name` text,
	`requester_phone` text,
	`requester_email` text,
	`reason` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "company_access_requests_status_check" CHECK("company_access_requests"."status" IN ('pending', 'approved', 'rejected', 'held'))
);--> statement-breakpoint
INSERT INTO `company_access_requests`("id", "reg_code", "company_name", "requester_name", "requester_phone", "requester_email", "reason", "status", "reviewed_by", "reviewed_at", "created_at", "updated_at") SELECT "id", "reg_code", "company_name", "requester_name", "requester_phone", "requester_email", "reason", "status", "reviewed_by", "reviewed_at", "created_at", "updated_at" FROM `__old_company_access_requests`;--> statement-breakpoint
DROP TABLE `__old_company_access_requests`;--> statement-breakpoint
ALTER TABLE `notification_templates` RENAME TO `__old_notification_templates`;--> statement-breakpoint
CREATE TABLE `notification_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`channel` text NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "notification_templates_channel_check" CHECK("notification_templates"."channel" IN ('email', 'sms')),
	CONSTRAINT "notification_templates_version_check" CHECK("notification_templates"."version" >= 1)
);--> statement-breakpoint
INSERT INTO `notification_templates`("id", "event", "channel", "subject", "body", "version", "active", "updated_by", "created_at", "updated_at") SELECT "id", "event", "channel", "subject", "body", "version", "active", "updated_by", "created_at", "updated_at" FROM `__old_notification_templates`;--> statement-breakpoint
DROP TABLE `__old_notification_templates`;--> statement-breakpoint
ALTER TABLE `notifications` RENAME TO `__old_notifications`;--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event` text NOT NULL,
	`channel` text,
	`title` text,
	`body` text,
	`payload` text,
	`read_at` text,
	`sent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`send_result` text,
	`recipient_results` text,
	`error_code` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "notifications_channel_check" CHECK("notifications"."channel" IN ('email', 'sms', 'in_app'))
);--> statement-breakpoint
INSERT INTO `notifications`("id", "user_id", "event", "channel", "title", "body", "payload", "read_at", "sent_at", "created_at", "updated_at", "send_result", "recipient_results", "error_code") SELECT "id", "user_id", "event", "channel", "title", "body", "payload", "read_at", "sent_at", "created_at", "updated_at", "send_result", "recipient_results", "error_code" FROM `__old_notifications`;--> statement-breakpoint
DROP TABLE `__old_notifications`;--> statement-breakpoint
ALTER TABLE `auction_subscriptions` RENAME TO `__old_auction_subscriptions`;--> statement-breakpoint
CREATE TABLE `auction_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`filter_json` text,
	`channel` text,
	`frequency` text,
	`unsubscribe_token` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "auction_subscriptions_channel_check" CHECK("auction_subscriptions"."channel" IN ('email', 'sms', 'in_app')),
	CONSTRAINT "auction_subscriptions_frequency_check" CHECK("auction_subscriptions"."frequency" IN ('immediate', 'daily', 'weekly')),
	CONSTRAINT "auction_subscriptions_status_check" CHECK("auction_subscriptions"."status" IN ('active', 'unsubscribed'))
);--> statement-breakpoint
INSERT INTO `auction_subscriptions`("id", "user_id", "filter_json", "channel", "frequency", "unsubscribe_token", "status", "created_at", "updated_at") SELECT "id", "user_id", "filter_json", "channel", "frequency", "unsubscribe_token", "status", "created_at", "updated_at" FROM `__old_auction_subscriptions`;--> statement-breakpoint
DROP TABLE `__old_auction_subscriptions`;--> statement-breakpoint
DROP TABLE `users_old`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_isikukood_hash_idx` ON `users` (`isikukood_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `auctions_slug_unique` ON `auctions` (`slug`);--> statement-breakpoint
CREATE INDEX `auctions_status_ends_at_idx` ON `auctions` (`status`,`ends_at`);--> statement-breakpoint
CREATE INDEX `auctions_object_type_idx` ON `auctions` (`object_type`);--> statement-breakpoint
CREATE INDEX `auctions_seller_idx` ON `auctions` (`seller_id`);--> statement-breakpoint
CREATE INDEX `auctions_cut_deadline_year_idx` ON `auctions` (`cut_deadline_year`);--> statement-breakpoint
CREATE INDEX `bids_auction_created_idx` ON `bids` (`auction_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `bids_idempotency_key_unique` ON `bids` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `bids_user_idx` ON `bids` (`user_id`);--> statement-breakpoint
CREATE INDEX `contracts_lot_idx` ON `contracts` (`lot_id`);--> statement-breakpoint
CREATE INDEX `contracts_template_idx` ON `contracts` (`template_id`);--> statement-breakpoint
CREATE INDEX `autobidders_auction_idx` ON `autobidders` (`auction_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `autobidders_user_auction_active_unique` ON `autobidders` (`user_id`,`auction_id`) WHERE "autobidders"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_access_token_hash_unique` ON `sessions` (`access_token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `auction_rights_user_object_idx` ON `auction_rights` (`user_id`,`object_type`);--> statement-breakpoint
CREATE INDEX `rights_requests_user_object_status_idx` ON `rights_requests` (`user_id`,`object_type`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_user_unique` ON `profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_entries_actor_idx` ON `audit_entries` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_entries_entity_idx` ON `audit_entries` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `maintenance_windows_starts_idx` ON `maintenance_windows` (`starts_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_tokens_token_hash_unique` ON `password_reset_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_user_id_idx` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `company_access_requests_status_idx` ON `company_access_requests` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `notification_templates_active_idx` ON `notification_templates` (`event`,`channel`) WHERE active = 1;--> statement-breakpoint
CREATE INDEX `notification_templates_event_channel_idx` ON `notification_templates` (`event`,`channel`);--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`user_id`,`read_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `auction_subscriptions_unsubscribe_token_unique` ON `auction_subscriptions` (`unsubscribe_token`);--> statement-breakpoint
CREATE INDEX `auction_subscriptions_user_idx` ON `auction_subscriptions` (`user_id`)