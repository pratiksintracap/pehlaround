CREATE TABLE IF NOT EXISTS "deal_images" (
  "id" serial PRIMARY KEY NOT NULL,
  "deal_id" integer NOT NULL,
  "mime" text NOT NULL,
  "data" text NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deal_images_deal_idx" ON "deal_images" USING btree ("deal_id");
