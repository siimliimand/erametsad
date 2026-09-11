PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "name", "role", "phone", "status", "auth_method", "isikukood_encrypted", "isikukood_iv", "isikukood_auth_tag", "isikukood_hash", "password_hash", "password_salt", "created_at", "updated_at") SELECT "id", "email", "name", "role", "phone", "status", "auth_method", "isikukood_encrypted", "isikukood_iv", "isikukood_auth_tag", "isikukood_hash", "password_hash", "password_salt", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_isikukood_hash_idx` ON `users` (`isikukood_hash`);
