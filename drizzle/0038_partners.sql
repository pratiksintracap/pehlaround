-- Partner firms and their relationship managers (MODEL.md §6, Partners).
-- A person at a partner firm has their own invite code; an office that registers through it is credited to that person.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ref_code" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_ref_code_uq" ON "users" ("ref_code");--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN IF NOT EXISTS "referred_by_user_id" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offices_referred_by_idx" ON "offices" ("referred_by");--> statement-breakpoint
ALTER TABLE "desk_invites" ADD COLUMN IF NOT EXISTS "referrer_user_id" integer;--> statement-breakpoint
ALTER TABLE "desk_invites" ADD COLUMN IF NOT EXISTS "investor_type" text;--> statement-breakpoint
-- What the desk asks of a partner firm for one issue: introductions and an amount. leg: pre_ipo | ipo.
CREATE TABLE IF NOT EXISTS "partner_targets" (
  "id" serial PRIMARY KEY NOT NULL,
  "office_id" integer NOT NULL,
  "deal_id" integer NOT NULL,
  "leg" text DEFAULT 'pre_ipo' NOT NULL,
  "intros" integer,
  "amount_cr" double precision,
  "note" text,
  "set_by" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "partner_targets_uq" ON "partner_targets" ("office_id","deal_id","leg");
