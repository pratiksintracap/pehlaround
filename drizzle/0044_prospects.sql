CREATE TABLE IF NOT EXISTS "prospects" (
  "id" serial PRIMARY KEY,
  "company" text NOT NULL,
  "norm" text NOT NULL,
  "cin" text,
  "city" text,
  "sector" text,
  "fy" text,
  "revenue_cr" double precision,
  "pat_cr" double precision,
  "growth_pct" double precision,
  "rating" text,
  "kind" text DEFAULT 'equity' NOT NULL,
  "why" text,
  "signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" text DEFAULT 'new' NOT NULL,
  "assignee_id" integer,
  "notes" text,
  "deal_id" integer,
  "found_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prospects_norm_uq" ON "prospects" ("norm");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prospects_status_idx" ON "prospects" ("status");
