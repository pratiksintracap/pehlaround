-- Deal lifecycle (MODEL.md §3): one "phase" column replaces the published / open / preview flags and the free-text
-- card tag and status line, which become read-only columns computed from it.
ALTER TABLE "deals" ADD COLUMN "phase" text NOT NULL DEFAULT 'preparing';--> statement-breakpoint
UPDATE "deals" SET "phase" = CASE WHEN "published" AND "open" THEN 'open' WHEN "published" THEN 'announced' WHEN "preview" THEN 'coming' ELSE 'preparing' END;--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT IF EXISTS "deals_listed_desk_only";--> statement-breakpoint
ALTER TABLE "deals" DROP COLUMN "published";--> statement-breakpoint
ALTER TABLE "deals" DROP COLUMN "open";--> statement-breakpoint
ALTER TABLE "deals" DROP COLUMN "preview";--> statement-breakpoint
ALTER TABLE "deals" DROP COLUMN "stage";--> statement-breakpoint
ALTER TABLE "deals" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "published" boolean GENERATED ALWAYS AS ("phase" IN ('announced','open','closed')) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "open" boolean GENERATED ALWAYS AS ("phase" = 'open') STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "preview" boolean GENERATED ALWAYS AS ("phase" = 'coming') STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "stage" text GENERATED ALWAYS AS (CASE "phase" WHEN 'preparing' THEN 'In preparation' WHEN 'coming' THEN 'Coming to the desk' WHEN 'announced' THEN 'Room opening soon' WHEN 'open' THEN 'Room open' WHEN 'closed' THEN 'Round closed' END) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "status" text GENERATED ALWAYS AS (CASE "phase" WHEN 'preparing' THEN 'In preparation' WHEN 'coming' THEN 'Being prepared by the desk' WHEN 'announced' THEN 'Overview live · room opens soon' WHEN 'open' THEN 'Room open to approved investors' WHEN 'closed' THEN 'Round closed · updates continue for holders' END) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_phase_chk" CHECK ("phase" IN ('preparing','coming','announced','open','closed'));--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_listed_desk_only" CHECK (NOT "listed" OR "phase" = 'preparing');
