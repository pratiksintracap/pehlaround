CREATE TABLE IF NOT EXISTS "transfer_kyc" (
  "id" serial PRIMARY KEY NOT NULL,
  "office_id" integer NOT NULL,
  "holder_name" text,
  "depository" text,
  "dp_name" text,
  "dp_id" text,
  "client_id" text,
  "bank_name" text,
  "ifsc" text,
  "account_last4" text,
  "updated_at" timestamp with time zone,
  "updated_by" text
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_kyc_office_uq" ON "transfer_kyc" ("office_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_files" (
  "id" serial PRIMARY KEY NOT NULL,
  "office_id" integer NOT NULL,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "mime" text NOT NULL,
  "size" integer NOT NULL,
  "data" text NOT NULL,
  "user_id" integer,
  "status" text DEFAULT 'received' NOT NULL,
  "desk_note" text,
  "checked_by" text,
  "checked_at" timestamp with time zone,
  "replaced_at" timestamp with time zone,
  "at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_files_office_idx" ON "kyc_files" ("office_id");
