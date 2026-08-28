CREATE TABLE `users` (
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
	CONSTRAINT "users_role_check" CHECK("users"."role" IN ('guest', 'private', 'company', 'seller', 'specialist', 'admin', 'superadmin')),
	CONSTRAINT "users_status_check" CHECK("users"."status" IN ('active', 'suspended')),
	CONSTRAINT "users_auth_method_check" CHECK("users"."auth_method" IN ('eid', 'password'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_isikukood_hash_idx` ON `users` (`isikukood_hash`);--> statement-breakpoint
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sessions_role_check" CHECK("sessions"."role" IN ('guest', 'private', 'company', 'seller', 'specialist', 'admin', 'superadmin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_access_token_hash_unique` ON `sessions` (`access_token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "profiles_type_check" CHECK("profiles"."type" IN ('private', 'company')),
	CONSTRAINT "profiles_approval_status_check" CHECK("profiles"."approval_status" IN ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_user_unique` ON `profiles` (`user_id`);--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE INDEX `company_access_requests_status_idx` ON `company_access_requests` (`status`);--> statement-breakpoint
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
	CONSTRAINT "auction_rights_object_type_check" CHECK("auction_rights"."object_type" IN ('raieoigus', 'kinnistu', 'kiire', 'pakett'))
);
--> statement-breakpoint
CREATE INDEX `auction_rights_user_object_idx` ON `auction_rights` (`user_id`,`object_type`);--> statement-breakpoint
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
	`min_bid_cents` integer NOT NULL,
	`bid_step_cents` integer,
	`reserve_price_cents` integer,
	`final_price_cents` integer,
	`fee_override_percent` integer,
	`vat_included` integer DEFAULT true NOT NULL,
	`description_public` text,
	`description_internal` text,
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
	CONSTRAINT "auctions_object_type_check" CHECK("auctions"."object_type" IN ('raieoigus', 'kinnistu', 'kiire', 'pakett')),
	CONSTRAINT "auctions_type_check" CHECK("auctions"."type" IN ('open', 'sealed')),
	CONSTRAINT "auctions_prices_check" CHECK("auctions"."min_bid_cents" >= 0 AND "auctions"."bid_step_cents" >= 0 AND "auctions"."reserve_price_cents" >= 0 AND "auctions"."final_price_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auctions_slug_unique` ON `auctions` (`slug`);--> statement-breakpoint
CREATE INDEX `auctions_status_ends_at_idx` ON `auctions` (`status`,`ends_at`);--> statement-breakpoint
CREATE INDEX `auctions_object_type_idx` ON `auctions` (`object_type`);--> statement-breakpoint
CREATE INDEX `auctions_seller_idx` ON `auctions` (`seller_id`);--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE INDEX `auction_subscriptions_user_idx` ON `auction_subscriptions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `auction_subscriptions_unsubscribe_token_unique` ON `auction_subscriptions` (`unsubscribe_token`);--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE INDEX `bids_auction_created_idx` ON `bids` (`auction_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `bids_user_idx` ON `bids` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bids_idempotency_key_unique` ON `bids` (`idempotency_key`);--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE INDEX `autobidders_auction_idx` ON `autobidders` (`auction_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `autobidders_user_auction_active_unique` ON `autobidders` (`user_id`,`auction_id`) WHERE "autobidders"."status" = 'active';--> statement-breakpoint
CREATE TABLE `contract_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`version` text NOT NULL,
	`placeholders` text,
	`docx_file_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "contract_templates_type_check" CHECK("contract_templates"."type" IN ('framework', 'auction'))
);
--> statement-breakpoint
CREATE INDEX `contract_templates_type_active_idx` ON `contract_templates` (`type`,`active`);--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE INDEX `contracts_lot_idx` ON `contracts` (`lot_id`);--> statement-breakpoint
CREATE INDEX `contracts_template_idx` ON `contracts` (`template_id`);--> statement-breakpoint
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "notifications_channel_check" CHECK("notifications"."channel" IN ('email', 'sms', 'in_app'))
);
--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`user_id`,`read_at`);--> statement-breakpoint
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
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_entries_entity_idx` ON `audit_entries` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_entries_actor_idx` ON `audit_entries` (`actor_id`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`form_name` text NOT NULL,
	`page_slug` text,
	`contact_name` text NOT NULL,
	`phone` text,
	`email` text,
	`cadastr` text,
	`consent_at` text NOT NULL,
	`source` text,
	`status` text DEFAULT 'new' NOT NULL,
	`ip_hash` text,
	`assigned_specialist_id` text,
	`internal_comment` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "leads_status_check" CHECK("leads"."status" IN ('new', 'contacted', 'qualified', 'contract', 'disqualified'))
);
--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`status`);--> statement-breakpoint
CREATE INDEX `leads_assigned_specialist_idx` ON `leads` (`assigned_specialist_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`org_name` text,
	`org_reg_code` text,
	`org_address` text,
	`fee_percent` integer DEFAULT 3 NOT NULL,
	`vat_percent` integer DEFAULT 22 NOT NULL,
	`anti_snipe_duration_minutes` integer DEFAULT 5 NOT NULL,
	`alapakkumine_enabled` integer DEFAULT true NOT NULL,
	`sealed_revision_cap` integer DEFAULT 3 NOT NULL,
	`feature_flags` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "settings_fee_percent_check" CHECK("settings"."fee_percent" >= 0 AND "settings"."fee_percent" <= 100)
);
--> statement-breakpoint
CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`excerpt` text,
	`content` text,
	`featured_image_id` text,
	`author` text,
	`published_at` text,
	`tags` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`featured_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "articles_status_check" CHECK("articles"."status" IN ('draft', 'published'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);--> statement-breakpoint
CREATE INDEX `articles_status_idx` ON `articles` (`status`);--> statement-breakpoint
CREATE TABLE `counties` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "counties_code_length_check" CHECK(length("counties"."code") = 2)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `counties_code_unique` ON `counties` (`code`);--> statement-breakpoint
CREATE TABLE `faq_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `faq_categories_slug_unique` ON `faq_categories` (`slug`);--> statement-breakpoint
CREATE TABLE `faq_items` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`category_id` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`slug` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `faq_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `faq_items_category_idx` ON `faq_items` (`category_id`);--> statement-breakpoint
CREATE TABLE `legal_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`type` text,
	`content` text NOT NULL,
	`version` text,
	`effective_date` text,
	`published_at` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "legal_documents_type_check" CHECK("legal_documents"."type" IN ('terms', 'privacy', 'cookies', 'contract')),
	CONSTRAINT "legal_documents_status_check" CHECK("legal_documents"."status" IN ('draft', 'published'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legal_documents_slug_unique` ON `legal_documents` (`slug`);--> statement-breakpoint
CREATE INDEX `legal_documents_type_idx` ON `legal_documents` (`type`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text,
	`filesize` integer,
	`width` integer,
	`height` integer,
	`alt` text,
	`r2_key` text,
	`url` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "media_status_check" CHECK("media"."status" IN ('draft', 'published'))
);
--> statement-breakpoint
CREATE INDEX `media_r2_key_idx` ON `media` (`r2_key`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`layout` text,
	`seo_title` text,
	`seo_description` text,
	`seo_og_image_id` text,
	`published_at` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`seo_og_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pages_status_check" CHECK("pages"."status" IN ('draft', 'published'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_slug_unique` ON `pages` (`slug`);--> statement-breakpoint
CREATE INDEX `pages_status_idx` ON `pages` (`status`);--> statement-breakpoint
CREATE TABLE `parishes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text,
	`county_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`county_id`) REFERENCES `counties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `parishes_county_idx` ON `parishes` (`county_id`);--> statement-breakpoint
CREATE TABLE `partner_services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`icon` text,
	`link` text,
	`order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_services_slug_unique` ON `partner_services` (`slug`);--> statement-breakpoint
CREATE TABLE `redirects` (
	`id` text PRIMARY KEY NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`type` text DEFAULT '301' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "redirects_type_check" CHECK("redirects"."type" IN ('301', '302'))
);
--> statement-breakpoint
CREATE INDEX `redirects_from_idx` ON `redirects` (`from`);--> statement-breakpoint
CREATE TABLE `specialists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`role` text,
	`phone` text,
	`email` text,
	`photo_id` text,
	`bio` text,
	`region` text,
	`active` integer DEFAULT true NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`photo_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `specialists_slug_unique` ON `specialists` (`slug`);--> statement-breakpoint
CREATE TABLE `statistics_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`object_type` text NOT NULL,
	`count` integer NOT NULL,
	`area` real,
	`volume` real,
	`eur_cents` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "statistics_snapshots_object_type_check" CHECK("statistics_snapshots"."object_type" IN ('raieoigus', 'kinnistu', 'kiire', 'pakett')),
	CONSTRAINT "statistics_snapshots_values_check" CHECK("statistics_snapshots"."count" >= 0 AND "statistics_snapshots"."area" >= 0 AND "statistics_snapshots"."volume" >= 0 AND "statistics_snapshots"."eur_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `statistics_snapshots_date_object_type_unique` ON `statistics_snapshots` (`date`,`object_type`);--> statement-breakpoint
CREATE TABLE `testimonials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`content` text NOT NULL,
	`avatar_id` text,
	`featured` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`avatar_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
