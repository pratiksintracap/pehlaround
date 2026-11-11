-- An IPO the desk works on for a company that never had a pre-IPO round here ("IPO only"). Such a deal is never on the
-- shelf: it stays in preparation, and shows only as a public issue once its price-band prospectus is filed.
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "ipo_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT IF EXISTS "deals_ipo_only_off_shelf";--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_ipo_only_off_shelf" CHECK (NOT "ipo_only" OR "phase" = 'preparing');--> statement-breakpoint
-- IPO interest a partner's relationship manager enters for a client: it counts only once the client confirms it,
-- from a personal link or its dashboard.
ALTER TABLE "ipo_bids" ADD COLUMN IF NOT EXISTS "proposed_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "ipo_bids" ADD COLUMN IF NOT EXISTS "proposed_by_office_id" integer;--> statement-breakpoint
ALTER TABLE "ipo_bids" ADD COLUMN IF NOT EXISTS "confirm_token" text;--> statement-breakpoint
ALTER TABLE "ipo_bids" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ipo_bids_token_uq" ON "ipo_bids" ("confirm_token");
