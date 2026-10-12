CREATE TABLE "deal_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"office_id" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "deal_views_deal_at_idx" ON "deal_views" USING btree ("deal_id","at");