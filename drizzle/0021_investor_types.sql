ALTER TABLE "offices" ADD COLUMN "investor_type" text DEFAULT 'family_office' NOT NULL;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "declaration" text;