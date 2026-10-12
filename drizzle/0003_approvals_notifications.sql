CREATE TABLE "broadcasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"audience" text NOT NULL,
	"deal_id" integer,
	"recipients" integer DEFAULT 0 NOT NULL,
	"emailed" integer DEFAULT 0 NOT NULL,
	"sent_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"office_id" integer,
	"to_admin" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"broadcast_id" integer,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "approval" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "notifications_office_idx" ON "notifications" USING btree ("office_id");--> statement-breakpoint
UPDATE "offices" SET "approval" = 'approved', "approved_at" = now() WHERE "status" <> 'rejected';