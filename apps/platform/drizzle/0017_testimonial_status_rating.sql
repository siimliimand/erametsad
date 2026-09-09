PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_testimonials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`content` text NOT NULL,
	`avatar_id` text,
	`featured` integer DEFAULT false NOT NULL,
	`rating` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`avatar_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "testimonials_status_check" CHECK("__new_testimonials"."status" IN ('draft', 'published'))
);
--> statement-breakpoint
-- drizzle-kit 0.31.10 rendered the copy step with the new column names on the
-- right side (no such column on the old table); copy only pre-existing
-- columns and let the DEFAULTs fill rating (NULL) and status ('draft').
INSERT INTO `__new_testimonials`("id", "name", "role", "content", "avatar_id", "featured", "created_at", "updated_at") SELECT "id", "name", "role", "content", "avatar_id", "featured", "created_at", "updated_at" FROM `testimonials`;--> statement-breakpoint
DROP TABLE `testimonials`;--> statement-breakpoint
ALTER TABLE `__new_testimonials` RENAME TO `testimonials`;--> statement-breakpoint
PRAGMA foreign_keys=ON;