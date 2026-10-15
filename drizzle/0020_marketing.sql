CREATE TABLE "email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"resend_id" text,
	"kind" text DEFAULT 'transactional' NOT NULL,
	"step" text,
	"user_id" integer,
	"office_id" integer,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_event" text,
	"last_event_at" timestamp with time zone,
	"checked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"office_id" integer,
	"user_id" integer,
	"deal_id" integer,
	"source" jsonb,
	"meta" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"token" text NOT NULL,
	"source" jsonb,
	"unsubscribed_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "source" jsonb;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "ref_code" text;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "referred_by" integer;--> statement-breakpoint
CREATE INDEX "email_log_sent_idx" ON "email_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "email_log_kind_step_idx" ON "email_log" USING btree ("kind","step");--> statement-breakpoint
CREATE INDEX "events_kind_at_idx" ON "events" USING btree ("kind","at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_email_uq" ON "subscribers" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_token_uq" ON "subscribers" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "offices_ref_code_uq" ON "offices" USING btree ("ref_code");