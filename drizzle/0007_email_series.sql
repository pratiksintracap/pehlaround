CREATE TABLE "email_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"office_id" integer,
	"step" text NOT NULL,
	"send_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_queue_user_step_uq" ON "email_queue" USING btree ("user_id","step");--> statement-breakpoint
CREATE INDEX "email_queue_due_idx" ON "email_queue" USING btree ("status","send_at");