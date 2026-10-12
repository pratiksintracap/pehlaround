CREATE TABLE "desk_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"office_name" text,
	"created_by" text,
	"used_at" timestamp with time zone,
	"office_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_hits" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "score" double precision;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "desk_invites_token_uq" ON "desk_invites" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "password_resets_token_uq" ON "password_resets" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "rate_hits_key_at_idx" ON "rate_hits" USING btree ("key","at");--> statement-breakpoint
UPDATE "deals" SET "score" = 8.6 WHERE "slug" = 'naval-defence-secondary' AND "score" IS NULL;--> statement-breakpoint
UPDATE "deals" SET "score" = 8.3 WHERE "slug" = 'jewellery-pre-ipo' AND "score" IS NULL;--> statement-breakpoint
UPDATE "deals" SET "score" = 8.1 WHERE "slug" = 'ai-collections-software' AND "score" IS NULL;--> statement-breakpoint
UPDATE "deals" SET "score" = 7.9 WHERE "slug" = 'waste-management-growth-round' AND "score" IS NULL;--> statement-breakpoint
UPDATE "deals" SET "score" = 7.7 WHERE "slug" = 'edible-oils-pre-ipo' AND "score" IS NULL;--> statement-breakpoint
UPDATE "deals" SET "score" = 7.5 WHERE "slug" = 'ethanol-distillery-pre-ipo' AND "score" IS NULL;
