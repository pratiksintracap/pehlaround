CREATE TABLE "deal_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"deal_id" integer NOT NULL,
	"office_id" integer,
	"email" text,
	"name" text,
	"office_name" text,
	"created_by" text,
	"opens" integer DEFAULT 0 NOT NULL,
	"opened_at" timestamp with time zone,
	"registered_at" timestamp with time zone,
	"registered_office_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "desk_invites" ADD COLUMN "referrer_office_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "intent" text;--> statement-breakpoint
CREATE UNIQUE INDEX "deal_links_token_uq" ON "deal_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "deal_links_deal_idx" ON "deal_links" USING btree ("deal_id");