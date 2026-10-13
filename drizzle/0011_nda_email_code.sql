CREATE TABLE "sign_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"deal_id" integer NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ndas" ADD COLUMN "signer_email" text;--> statement-breakpoint
ALTER TABLE "ndas" ADD COLUMN "code_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "sign_codes_user_deal_idx" ON "sign_codes" USING btree ("user_id","deal_id");