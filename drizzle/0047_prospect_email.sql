ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "email_body" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "sends" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "approved_by" text;
