ALTER TABLE "documents" ADD COLUMN "audience" text DEFAULT 'nda' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "office_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;