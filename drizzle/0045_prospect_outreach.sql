ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "contact_name" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "contact_role" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "contact_email" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "website" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "email_subject" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "drafted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "emailed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "replied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "task_id" integer;
