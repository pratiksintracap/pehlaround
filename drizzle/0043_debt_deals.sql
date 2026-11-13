ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "debt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "debt_info" jsonb;--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT IF EXISTS "deals_debt_desk_only";--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_debt_desk_only" CHECK (NOT "debt" OR "phase" = 'preparing');
