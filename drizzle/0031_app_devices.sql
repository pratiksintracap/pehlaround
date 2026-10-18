CREATE TABLE IF NOT EXISTS "app_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"platform" text NOT NULL,
	"push_token" text,
	"secret_hash" text,
	"session_version" integer,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "app_devices_push_uq" ON "app_devices" USING btree ("push_token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_devices_user_idx" ON "app_devices" USING btree ("user_id");
