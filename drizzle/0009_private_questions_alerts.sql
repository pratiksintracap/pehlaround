ALTER TABLE "deal_prefs" ADD COLUMN "alerts_set" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "private" boolean DEFAULT false NOT NULL;