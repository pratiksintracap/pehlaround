CREATE TABLE "ai_chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"office_id" integer,
	"user_id" integer NOT NULL,
	"deal_id" integer,
	"title" text NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"searches" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_chats_user_idx" ON "ai_chats" USING btree ("user_id","deal_id");