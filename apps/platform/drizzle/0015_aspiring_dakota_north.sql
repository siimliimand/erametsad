PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`category` text DEFAULT 'uudised' NOT NULL,
	`excerpt` text,
	`content` text,
	`featured_image_id` text,
	`author` text,
	`author_specialist_id` text,
	`seo_title` text,
	`seo_description` text,
	`og_image_id` text,
	`canonical_url` text,
	`robots_index` integer DEFAULT true NOT NULL,
	`published_at` text,
	`tags` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`featured_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`og_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "articles_status_check" CHECK("__new_articles"."status" IN ('draft', 'published')),
	CONSTRAINT "articles_category_check" CHECK("__new_articles"."category" IN ('uudised', 'klientide-lood'))
);
--> statement-breakpoint
-- drizzle-kit 0.31.10 rendered the copy step with the new column names on the
-- right side (no such column on the old table); copy only pre-existing
-- columns and let the DEFAULTs fill category ('uudised') and robots_index (1).
INSERT INTO `__new_articles`("id", "title", "slug", "excerpt", "content", "featured_image_id", "author", "published_at", "tags", "status", "created_at", "updated_at") SELECT "id", "title", "slug", "excerpt", "content", "featured_image_id", "author", "published_at", "tags", "status", "created_at", "updated_at" FROM `articles`;--> statement-breakpoint
DROP TABLE `articles`;--> statement-breakpoint
ALTER TABLE `__new_articles` RENAME TO `articles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);--> statement-breakpoint
CREATE INDEX `articles_status_idx` ON `articles` (`status`);--> statement-breakpoint
CREATE INDEX `articles_author_specialist_idx` ON `articles` (`author_specialist_id`);