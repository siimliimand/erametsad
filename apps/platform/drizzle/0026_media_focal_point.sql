PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_media` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text,
	`filesize` integer,
	`width` integer,
	`height` integer,
	`alt` text,
	`focal_x` real,
	`focal_y` real,
	`r2_key` text,
	`url` text,
	`renditions` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "media_status_check" CHECK("__new_media"."status" IN ('draft', 'published')),
	CONSTRAINT "media_focal_x_check" CHECK(("__new_media"."focal_x" IS NULL OR ("__new_media"."focal_x" >= 0 AND "__new_media"."focal_x" <= 1))),
	CONSTRAINT "media_focal_y_check" CHECK(("__new_media"."focal_y" IS NULL OR ("__new_media"."focal_y" >= 0 AND "__new_media"."focal_y" <= 1)))
);
--> statement-breakpoint
INSERT INTO `__new_media`("id", "filename", "mime_type", "filesize", "width", "height", "alt", "focal_x", "focal_y", "r2_key", "url", "renditions", "status", "created_at", "updated_at") SELECT "id", "filename", "mime_type", "filesize", "width", "height", "alt", NULL, NULL, "r2_key", "url", "renditions", "status", "created_at", "updated_at" FROM `media`;--> statement-breakpoint
DROP TABLE `media`;--> statement-breakpoint
ALTER TABLE `__new_media` RENAME TO `media`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `media_r2_key_idx` ON `media` (`r2_key`);