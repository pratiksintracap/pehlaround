ALTER TABLE "deals" ADD COLUMN "listed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "listed_info" jsonb;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "pipeline_stage" text DEFAULT 'sourced' NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "stage_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "owner_id" integer;--> statement-breakpoint
UPDATE "deals" SET "pipeline_stage" = CASE WHEN "published" AND "open" THEN 'interest' WHEN "published" THEN 'live' ELSE 'diligence' END, "stage_at" = now();--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_listed_desk_only" CHECK (NOT "listed" OR (NOT "published" AND NOT "open" AND NOT "preview"));--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "origin" text DEFAULT 'registered' NOT NULL;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "added_by" text;--> statement-breakpoint
ALTER TABLE "audit" ADD COLUMN "entity" text;--> statement-breakpoint
ALTER TABLE "audit" ADD COLUMN "entity_id" integer;--> statement-breakpoint
ALTER TABLE "audit" ADD COLUMN "detail" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_deal_idx" ON "audit" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_entity_idx" ON "audit" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "desk_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer,
	"office_id" integer,
	"body" text NOT NULL,
	"user_id" integer,
	"who" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "desk_notes_deal_idx" ON "desk_notes" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "desk_notes_office_idx" ON "desk_notes" USING btree ("office_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "desk_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"kind" text,
	"note" text,
	"user_id" integer,
	"who" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "desk_files_deal_idx" ON "desk_files" USING btree ("deal_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"deal_id" integer,
	"office_id" integer,
	"assignee_id" integer,
	"due_on" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_by_id" integer,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone,
	"done_by" text,
	"reminded_on" text
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_assignee_idx" ON "tasks" USING btree ("assignee_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_deal_idx" ON "tasks" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_office_idx" ON "tasks" USING btree ("office_id");
