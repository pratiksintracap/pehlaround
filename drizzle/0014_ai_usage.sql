CREATE TABLE "ai_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" integer,
	"user_id" integer NOT NULL,
	"office_id" integer,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"searches" integer DEFAULT 0 NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_usage_at_idx" ON "ai_usage" USING btree ("at");