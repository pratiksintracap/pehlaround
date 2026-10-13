ALTER TABLE "offices" ADD COLUMN "aum" text;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "structures" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "horizon" text;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "thesis" text;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "co_lead" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "profile_at" timestamp with time zone;