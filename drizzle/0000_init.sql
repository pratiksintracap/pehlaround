CREATE TABLE "audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"office_id" integer,
	"user_id" integer,
	"who" text,
	"action" text NOT NULL,
	"deal_id" integer,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"office_id" integer,
	"user_id" integer,
	"kind" text DEFAULT 'request' NOT NULL,
	"title" text,
	"slot" text,
	"attendees" text,
	"questions" text,
	"status" text DEFAULT 'Requested' NOT NULL,
	"scheduled_for" text,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_prefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"office_id" integer NOT NULL,
	"alerts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ticks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"saved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"headline" text NOT NULL,
	"listing_label" text NOT NULL,
	"listing_month" text,
	"listing_note" text,
	"round_label" text,
	"pre_money" text,
	"pe_label" text,
	"min_ticket" text,
	"open" boolean DEFAULT true NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 100 NOT NULL,
	"art" text,
	"public_risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"as_of" text,
	"nda_version" text DEFAULT '2026-10-12' NOT NULL,
	"room" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"office_id" integer,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"title" text NOT NULL,
	"kind" text,
	"status" text DEFAULT 'available' NOT NULL,
	"url" text,
	"sort" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interests" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"office_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"amount_cr" numeric NOT NULL,
	"colead" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'Indicated' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"office_id" integer NOT NULL,
	"email" text NOT NULL,
	"rights" text DEFAULT 'View' NOT NULL,
	"invited_by" integer,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'founder' NOT NULL,
	"name" text,
	"company" text,
	"email" text,
	"phone" text,
	"data" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'New' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ndas" (
	"id" serial PRIMARY KEY NOT NULL,
	"office_id" integer NOT NULL,
	"deal_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"signer_name" text NOT NULL,
	"version" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"revoked_at" timestamp with time zone,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offices" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"residency" text,
	"ticket" text,
	"entity_name" text,
	"pan" text,
	"pan_name" text,
	"status" text DEFAULT 'registered' NOT NULL,
	"verified_at" timestamp with time zone,
	"consents" jsonb DEFAULT '{}'::jsonb,
	"sectors" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passes" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"office_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"office_id" integer,
	"user_id" integer,
	"question" text NOT NULL,
	"answer" text,
	"answered_by" text,
	"asked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"hidden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"role" text DEFAULT 'member' NOT NULL,
	"office_role" text,
	"rights" text DEFAULT 'View, comment, commit' NOT NULL,
	"office_id" integer,
	"password_hash" text NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_prefs" ADD CONSTRAINT "deal_prefs_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_views" ADD CONSTRAINT "doc_views_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_views" ADD CONSTRAINT "doc_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interests" ADD CONSTRAINT "interests_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ndas" ADD CONSTRAINT "ndas_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ndas" ADD CONSTRAINT "ndas_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ndas" ADD CONSTRAINT "ndas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_office_idx" ON "audit" USING btree ("office_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_prefs_uq" ON "deal_prefs" USING btree ("office_id","deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deals_slug_uq" ON "deals" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "ndas_office_deal_uq" ON "ndas" USING btree ("office_id","deal_id");--> statement-breakpoint
CREATE INDEX "questions_deal_idx" ON "questions" USING btree ("deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");