-- An office's own record of what it holds outside the desk (unlisted shares bought elsewhere, and listed holdings
-- imported from a broker's file), valued at the office's own price. Private to the office: no desk screen reads it.
CREATE TABLE IF NOT EXISTS "outside_holdings" (
  "id" serial PRIMARY KEY NOT NULL,
  "office_id" integer NOT NULL,
  "user_id" integer,
  "kind" text DEFAULT 'unlisted' NOT NULL,
  "company" text NOT NULL,
  "symbol" text,
  "isin" text,
  "shares" double precision,
  "cost_per_share" double precision,
  "bought_on" text,
  "value_per_share" double precision,
  "valued_on" text,
  "via" text,
  "note" text,
  "source" text DEFAULT 'manual' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outside_holdings_office_idx" ON "outside_holdings" ("office_id");--> statement-breakpoint
-- Companies an office follows for IPO news, matched by name against the IPO calendar; the stages it was told about.
CREATE TABLE IF NOT EXISTS "watches" (
  "id" serial PRIMARY KEY NOT NULL,
  "office_id" integer NOT NULL,
  "user_id" integer,
  "name" text NOT NULL,
  "norm" text NOT NULL,
  "told" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "watches_office_norm_uq" ON "watches" ("office_id","norm");
