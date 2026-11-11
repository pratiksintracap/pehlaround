-- After an allocation is agreed: the dates of each closing step (term sheet, documents, funds, shares credited), kept
-- by the desk and shown to that office. And updates a company sends its holders, drafted by the promoter or the desk.
ALTER TABLE "interests" ADD COLUMN IF NOT EXISTS "closing" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deal_updates" (
  "id" serial PRIMARY KEY NOT NULL,
  "deal_id" integer NOT NULL,
  "title" text NOT NULL,
  "period" text,
  "body" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "from_promoter" boolean DEFAULT false NOT NULL,
  "drafted_by" text,
  "published_by" text,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deal_updates_deal_idx" ON "deal_updates" ("deal_id","status");
