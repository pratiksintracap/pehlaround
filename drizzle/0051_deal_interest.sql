CREATE TABLE IF NOT EXISTS "deal_interest" (
  "id" serial PRIMARY KEY NOT NULL,
  "deal_id" integer NOT NULL,
  "name" text NOT NULL,
  "firm" text,
  "contact" text,
  "channel" text,
  "status" text DEFAULT 'pitched' NOT NULL,
  "amount_cr" double precision,
  "note" text,
  "office_id" integer,
  "last_on" text,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deal_interest_deal_idx" ON "deal_interest" USING btree ("deal_id");
