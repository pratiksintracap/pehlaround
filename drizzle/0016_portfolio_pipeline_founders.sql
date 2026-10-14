ALTER TABLE "deals" ADD COLUMN "round_cr" double precision;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "ipo" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "promoter_demand" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "proposed_by" text;--> statement-breakpoint
ALTER TABLE "interests" ADD COLUMN "shares" integer;--> statement-breakpoint
ALTER TABLE "interests" ADD COLUMN "price" double precision;--> statement-breakpoint
ALTER TABLE "interests" ADD COLUMN "allotted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "draft_answer" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "draft_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "promoter_deal_id" integer;