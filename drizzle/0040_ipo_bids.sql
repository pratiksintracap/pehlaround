-- The IPO leg: an office's indication of interest in a company's public issue, once its price-band prospectus is filed.
-- Not an application: the office applies through its own broker. One row per office per issue.
CREATE TABLE IF NOT EXISTS "ipo_bids" (
  "id" serial PRIMARY KEY NOT NULL,
  "deal_id" integer NOT NULL,
  "office_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "category" text NOT NULL,
  "amount_cr" numeric NOT NULL,
  "status" text DEFAULT 'Indicated' NOT NULL,
  "broker" text,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ipo_bids_office_deal_uq" ON "ipo_bids" ("office_id","deal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ipo_bids_deal_idx" ON "ipo_bids" ("deal_id");
