CREATE TYPE "public"."credit_access_request_status" AS ENUM('new', 'contacted', 'approved', 'declined');
--> statement-breakpoint
CREATE TYPE "public"."credit_access_side" AS ENUM('borrower', 'lender');
--> statement-breakpoint
CREATE TYPE "public"."credit_allocation_status" AS ENUM('interested', 'sanctioned', 'disbursed', 'declined', 'withdrawn');
--> statement-breakpoint
CREATE TYPE "public"."credit_borrower_status" AS ENUM('prospect', 'onboarding', 'active', 'inactive');
--> statement-breakpoint
CREATE TYPE "public"."credit_diligence_status" AS ENUM('not_started', 'in_review', 'approved', 'rejected', 'refresh_required');
--> statement-breakpoint
CREATE TYPE "public"."credit_direct_deal_lender_status" AS ENUM('to_approach', 'approached', 'interested', 'term_sheet', 'sanctioned', 'declined');
--> statement-breakpoint
CREATE TYPE "public"."credit_direct_deal_stage" AS ENUM('lead', 'diligence', 'with_lenders', 'term_sheet', 'sanctioned', 'disbursed', 'on_hold', 'closed_lost');
--> statement-breakpoint
CREATE TYPE "public"."credit_drawdown_cycle" AS ENUM('monthly', 'quarterly', 'yearly');
--> statement-breakpoint
CREATE TYPE "public"."credit_intake_status" AS ENUM('draft', 'submitted', 'needs_info', 'in_review', 'accepted', 'declined');
--> statement-breakpoint
CREATE TYPE "public"."credit_item_status" AS ENUM('pending', 'received', 'accepted', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."credit_prospect_status" AS ENUM('new', 'contacted', 'replied', 'interested', 'onboarded', 'not_a_fit', 'do_not_contact');
--> statement-breakpoint
CREATE TYPE "public"."credit_raise_status" AS ENUM('draft', 'open', 'funded', 'closed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."credit_session_stage" AS ENUM('totp_enroll', 'totp_verify', 'active');
--> statement-breakpoint
CREATE TYPE "public"."credit_user_role" AS ENUM('platform_admin', 'lender_admin', 'lender_viewer', 'partner', 'applicant');
--> statement-breakpoint
CREATE TABLE "credit_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"side" "credit_access_side" NOT NULL,
	"name" text NOT NULL,
	"organisation" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text,
	"status" "credit_access_request_status" DEFAULT 'new' NOT NULL,
	"consent_notice_version" text,
	"consented_at" timestamp with time zone,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_activity_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"actor_role" text NOT NULL,
	"lender_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_allocation_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"allocation_id" uuid NOT NULL,
	"raise_id" uuid NOT NULL,
	"lender_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"value_date" date NOT NULL,
	"note" text,
	"entered_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_allocation_movements_kind" CHECK ("credit_allocation_movements"."kind" in ('disbursement', 'repayment')),
	CONSTRAINT "credit_allocation_movements_amount_positive" CHECK ("credit_allocation_movements"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "credit_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raise_id" uuid NOT NULL,
	"lender_id" uuid NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"status" "credit_allocation_status" DEFAULT 'interested' NOT NULL,
	"terms_version" integer,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_allocation_amount_positive" CHECK ("credit_allocations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "credit_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"raise_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	CONSTRAINT "credit_approvals_kind" CHECK ("credit_approvals"."kind" in ('share', 'sanction')),
	CONSTRAINT "credit_approvals_status" CHECK ("credit_approvals"."status" in ('pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "credit_approvals_no_self_approval" CHECK ("credit_approvals"."status" in ('pending', 'cancelled') or "credit_approvals"."decided_by" <> "credit_approvals"."requested_by")
);
--> statement-breakpoint
CREATE TABLE "credit_blobs" (
	"key" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_borrower_financials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" uuid NOT NULL,
	"period_end" date NOT NULL,
	"aum" numeric(18, 2),
	"gnpa_pct" numeric(6, 2),
	"leverage" numeric(8, 2),
	"entered_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "borrower_financials_quarter_end" CHECK ((extract(month from "credit_borrower_financials"."period_end"), extract(day from "credit_borrower_financials"."period_end")) in ((3,31),(6,30),(9,30),(12,31)))
);
--> statement-breakpoint
CREATE TABLE "credit_borrower_segments" (
	"borrower_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	CONSTRAINT "credit_borrower_segments_borrower_id_segment_id_pk" PRIMARY KEY("borrower_id","segment_id")
);
--> statement-breakpoint
CREATE TABLE "credit_borrowers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cin" text,
	"rbi_registration" text,
	"city" text,
	"state" text,
	"status" "credit_borrower_status" DEFAULT 'prospect' NOT NULL,
	"drawdown_cycle" "credit_drawdown_cycle" DEFAULT 'monthly' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_checklist_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_deal_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raise_id" uuid NOT NULL,
	"lender_id" uuid NOT NULL,
	"author_user_id" uuid,
	"author_side" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_deal_messages_side" CHECK ("credit_deal_messages"."author_side" in ('platform', 'lender'))
);
--> statement-breakpoint
CREATE TABLE "credit_deal_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raise_id" uuid NOT NULL,
	"lender_id" uuid NOT NULL,
	"shared_by" uuid,
	"shared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "credit_diligence_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "credit_item_status" DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_diligence_l1" (
	"borrower_id" uuid PRIMARY KEY NOT NULL,
	"status" "credit_diligence_status" DEFAULT 'not_started' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"refresh_due_at" timestamp with time zone,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_diligence_l1_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" uuid NOT NULL,
	"status" "credit_diligence_status" NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_direct_deal_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"content_type" text,
	"size_bytes" integer NOT NULL,
	"sha256" text,
	"parts" text[] NOT NULL,
	"part_count" integer NOT NULL,
	"completed_at" timestamp with time zone,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_direct_deal_files_parts" CHECK ("credit_direct_deal_files"."part_count" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "credit_direct_deal_lenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"lender_id" uuid,
	"lender_name" text,
	"status" "credit_direct_deal_lender_status" DEFAULT 'to_approach' NOT NULL,
	"amount_cr" numeric(12, 2),
	"rate" text,
	"note" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_direct_deal_lenders_who" CHECK ("credit_direct_deal_lenders"."lender_id" is not null or "credit_direct_deal_lenders"."lender_name" is not null)
);
--> statement-breakpoint
CREATE TABLE "credit_direct_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"cin" text,
	"sector" text,
	"city" text,
	"state" text,
	"amount_cr" numeric(12, 2) NOT NULL,
	"facility" text,
	"purpose" text,
	"tenor_months" integer,
	"security" text,
	"rate_expectation" text,
	"stage" "credit_direct_deal_stage" DEFAULT 'lead' NOT NULL,
	"source" text,
	"contact_name" text,
	"contact_role" text,
	"contact_email" text,
	"contact_phone" text,
	"next_step" text,
	"next_step_on" date,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_direct_deals_amount_positive" CHECK ("credit_direct_deals"."amount_cr" > 0),
	CONSTRAINT "credit_direct_deals_tenor" CHECK ("credit_direct_deals"."tenor_months" is null or "credit_direct_deals"."tenor_months" between 1 and 600)
);
--> statement-breakpoint
CREATE TABLE "credit_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" uuid NOT NULL,
	"diligence_item_id" uuid,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by" uuid,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "credit_instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "credit_instruments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "credit_intake_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"question_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text,
	"size_bytes" integer NOT NULL,
	"sha256" text,
	"parts" text[] NOT NULL,
	"part_count" integer NOT NULL,
	"completed_at" timestamp with time zone,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_intake_files_size" CHECK ("credit_intake_files"."size_bytes" > 0),
	CONSTRAINT "credit_intake_files_parts" CHECK ("credit_intake_files"."part_count" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "credit_intake_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid,
	"source" text DEFAULT 'partner' NOT NULL,
	"submitter_role" text,
	"submitter_name" text,
	"submitter_email" text,
	"submitter_phone" text,
	"agent_firm" text,
	"access_token_hash" text,
	"access_token_enc" text,
	"ip" text,
	"consent_notice_version" text,
	"consented_at" timestamp with time zone,
	"company_name" text NOT NULL,
	"cin" text,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"form_version" integer DEFAULT 1 NOT NULL,
	"status" "credit_intake_status" DEFAULT 'draft' NOT NULL,
	"team_note" text,
	"submitted_at" timestamp with time zone,
	"borrower_id" uuid,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_intake_submissions_access_token_hash_unique" UNIQUE("access_token_hash"),
	CONSTRAINT "intake_submissions_source" CHECK (("credit_intake_submissions"."source" = 'partner' and "credit_intake_submissions"."partner_id" is not null) or ("credit_intake_submissions"."source" = 'public' and "credit_intake_submissions"."partner_id" is null and "credit_intake_submissions"."access_token_hash" is not null and "credit_intake_submissions"."submitter_role" in ('company', 'agent')))
);
--> statement-breakpoint
CREATE TABLE "credit_lender_instruments" (
	"lender_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	CONSTRAINT "credit_lender_instruments_lender_id_instrument_id_pk" PRIMARY KEY("lender_id","instrument_id")
);
--> statement-breakpoint
CREATE TABLE "credit_lender_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lender_id" uuid NOT NULL,
	"borrower_id" uuid NOT NULL,
	"status" "credit_diligence_status" DEFAULT 'not_started' NOT NULL,
	"notes" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_lender_security_levels" (
	"lender_id" uuid NOT NULL,
	"security_level_id" uuid NOT NULL,
	CONSTRAINT "credit_lender_security_levels_lender_id_security_level_id_pk" PRIMARY KEY("lender_id","security_level_id")
);
--> statement-breakpoint
CREATE TABLE "credit_lender_segment_targets" (
	"lender_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"target_exposure" numeric(18, 2),
	CONSTRAINT "credit_lender_segment_targets_lender_id_segment_id_pk" PRIMARY KEY("lender_id","segment_id")
);
--> statement-breakpoint
CREATE TABLE "credit_lenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"min_ticket" numeric(18, 2),
	"max_ticket" numeric(18, 2),
	"min_rate" numeric(6, 2),
	"max_rate" numeric(6, 2),
	"thesis_notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_lender_ticket_order" CHECK ("credit_lenders"."min_ticket" is null or "credit_lenders"."max_ticket" is null or "credit_lenders"."min_ticket" <= "credit_lenders"."max_ticket"),
	CONSTRAINT "credit_lender_rate_order" CHECK ("credit_lenders"."min_rate" is null or "credit_lenders"."max_rate" is null or "credit_lenders"."min_rate" <= "credit_lenders"."max_rate")
);
--> statement-breakpoint
CREATE TABLE "credit_login_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_outreach_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"from_name" text NOT NULL,
	"reply_to" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_outreach_emails_status" CHECK ("credit_outreach_emails"."status" in ('queued', 'sending', 'sent', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "credit_outreach_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_outreach_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "credit_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_prospect_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"band_min_cr" numeric(12, 2) DEFAULT '50' NOT NULL,
	"band_max_cr" numeric(12, 2) DEFAULT '250' NOT NULL,
	"direct_min_cr" numeric(12, 2) DEFAULT '25' NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_prospect_settings_single" CHECK ("credit_prospect_settings"."id" = 1),
	CONSTRAINT "credit_prospect_settings_band" CHECK ("credit_prospect_settings"."band_min_cr" <= "credit_prospect_settings"."band_max_cr")
);
--> statement-breakpoint
CREATE TABLE "credit_prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"registry_key" text NOT NULL,
	"cin" text,
	"rbi_reg_no" text,
	"regional_office" text,
	"address" text,
	"registered_email" text,
	"classification" text,
	"layer" text,
	"state" text,
	"last_seen_in_import_at" timestamp with time zone,
	"loan_book_cr" numeric(12, 2),
	"aum_cr" numeric(12, 2),
	"size_as_of" date,
	"size_source" text,
	"segment" text,
	"website" text,
	"rating_agency" text,
	"rating" text,
	"rating_grade" text,
	"rating_outlook" text,
	"rating_date" date,
	"rating_url" text,
	"gnpa_pct" numeric(6, 2),
	"crar_pct" numeric(6, 2),
	"bank_facilities_cr" numeric(12, 2),
	"lenders" text[],
	"charges_total_cr" numeric(12, 2),
	"directors" text,
	"last_filing_on" date,
	"research_notes" text,
	"researched_at" timestamp with time zone,
	"status" "credit_prospect_status" DEFAULT 'new' NOT NULL,
	"contact_name" text,
	"contact_role" text,
	"contact_email" text,
	"contact_phone" text,
	"notes" text,
	"next_follow_up" date,
	"last_contacted_at" timestamp with time zone,
	"borrower_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_prospects_registry_key_unique" UNIQUE("registry_key"),
	CONSTRAINT "credit_prospects_size_positive" CHECK (("credit_prospects"."loan_book_cr" is null or "credit_prospects"."loan_book_cr" >= 0) and ("credit_prospects"."aum_cr" is null or "credit_prospects"."aum_cr" >= 0))
);
--> statement-breakpoint
CREATE TABLE "credit_raise_economics" (
	"raise_id" uuid PRIMARY KEY NOT NULL,
	"borrower_rate" numeric(6, 2),
	"expected_rate_min" numeric(6, 2),
	"expected_rate_max" numeric(6, 2),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_raise_terms_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raise_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"lender_rate" numeric(6, 2),
	"instrument_id" uuid,
	"segment_id" uuid,
	"purpose" text,
	"security_level_id" uuid,
	"security_description" text,
	"terms" text,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_raises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" uuid NOT NULL,
	"cycle_start" date NOT NULL,
	"cycle" "credit_drawdown_cycle" NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"lender_rate" numeric(6, 2),
	"instrument_id" uuid,
	"segment_id" uuid,
	"purpose" text,
	"security_level_id" uuid,
	"security_description" text,
	"terms" text,
	"status" "credit_raise_status" DEFAULT 'draft' NOT NULL,
	"filled_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"terms_version" integer DEFAULT 1 NOT NULL,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_raise_amount_positive" CHECK ("credit_raises"."amount" > 0),
	CONSTRAINT "credit_raise_cycle_first_of_month" CHECK (extract(day from "credit_raises"."cycle_start") = 1)
);
--> statement-breakpoint
CREATE TABLE "credit_security_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rank" integer NOT NULL,
	CONSTRAINT "credit_security_levels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "credit_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "credit_segments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "credit_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"stage" "credit_session_stage" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text,
	CONSTRAINT "credit_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "credit_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "credit_user_role" NOT NULL,
	"lender_id" uuid,
	"partner_id" uuid,
	"totp_secret" text,
	"totp_enabled_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_users_email_unique" UNIQUE("email"),
	CONSTRAINT "user_role_org" CHECK (("credit_users"."role"::text = 'platform_admin' and "credit_users"."lender_id" is null and "credit_users"."partner_id" is null)
        or ("credit_users"."role"::text = 'partner' and "credit_users"."partner_id" is not null and "credit_users"."lender_id" is null)
        or ("credit_users"."role"::text = 'applicant' and "credit_users"."partner_id" is null and "credit_users"."lender_id" is null)
        or ("credit_users"."role"::text in ('lender_admin', 'lender_viewer') and "credit_users"."lender_id" is not null and "credit_users"."partner_id" is null)),
	CONSTRAINT "credit_user_email_lower" CHECK ("credit_users"."email" = lower("credit_users"."email"))
);
--> statement-breakpoint
ALTER TABLE "credit_activity_log" ADD CONSTRAINT "credit_activity_log_actor_user_id_credit_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_allocation_movements" ADD CONSTRAINT "credit_allocation_movements_allocation_id_credit_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."credit_allocations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_allocation_movements" ADD CONSTRAINT "credit_allocation_movements_raise_id_credit_raises_id_fk" FOREIGN KEY ("raise_id") REFERENCES "public"."credit_raises"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_allocation_movements" ADD CONSTRAINT "credit_allocation_movements_lender_id_credit_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."credit_lenders"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_allocation_movements" ADD CONSTRAINT "credit_allocation_movements_entered_by_credit_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_allocations" ADD CONSTRAINT "credit_allocations_raise_id_credit_raises_id_fk" FOREIGN KEY ("raise_id") REFERENCES "public"."credit_raises"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_allocations" ADD CONSTRAINT "credit_allocations_lender_id_credit_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."credit_lenders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_allocations" ADD CONSTRAINT "credit_allocations_updated_by_credit_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_approvals" ADD CONSTRAINT "credit_approvals_raise_id_credit_raises_id_fk" FOREIGN KEY ("raise_id") REFERENCES "public"."credit_raises"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_approvals" ADD CONSTRAINT "credit_approvals_requested_by_credit_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_approvals" ADD CONSTRAINT "credit_approvals_decided_by_credit_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_borrower_financials" ADD CONSTRAINT "credit_borrower_financials_borrower_id_credit_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."credit_borrowers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_borrower_financials" ADD CONSTRAINT "credit_borrower_financials_entered_by_credit_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_borrower_segments" ADD CONSTRAINT "credit_borrower_segments_borrower_id_credit_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."credit_borrowers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_borrower_segments" ADD CONSTRAINT "credit_borrower_segments_segment_id_credit_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."credit_segments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_deal_messages" ADD CONSTRAINT "credit_deal_messages_raise_id_credit_raises_id_fk" FOREIGN KEY ("raise_id") REFERENCES "public"."credit_raises"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_deal_messages" ADD CONSTRAINT "credit_deal_messages_lender_id_credit_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."credit_lenders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_deal_messages" ADD CONSTRAINT "credit_deal_messages_author_user_id_credit_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_deal_shares" ADD CONSTRAINT "credit_deal_shares_raise_id_credit_raises_id_fk" FOREIGN KEY ("raise_id") REFERENCES "public"."credit_raises"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_deal_shares" ADD CONSTRAINT "credit_deal_shares_lender_id_credit_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."credit_lenders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_deal_shares" ADD CONSTRAINT "credit_deal_shares_shared_by_credit_users_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_diligence_items" ADD CONSTRAINT "credit_diligence_items_borrower_id_credit_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."credit_borrowers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_diligence_items" ADD CONSTRAINT "credit_diligence_items_reviewed_by_credit_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_diligence_l1" ADD CONSTRAINT "credit_diligence_l1_borrower_id_credit_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."credit_borrowers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_diligence_l1" ADD CONSTRAINT "credit_diligence_l1_reviewed_by_credit_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_diligence_l1_history" ADD CONSTRAINT "credit_diligence_l1_history_borrower_id_credit_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."credit_borrowers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_diligence_l1_history" ADD CONSTRAINT "credit_diligence_l1_history_decided_by_credit_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_direct_deal_files" ADD CONSTRAINT "credit_direct_deal_files_deal_id_credit_direct_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."credit_direct_deals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_direct_deal_files" ADD CONSTRAINT "credit_direct_deal_files_uploaded_by_credit_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_direct_deal_lenders" ADD CONSTRAINT "credit_direct_deal_lenders_deal_id_credit_direct_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."credit_direct_deals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_direct_deal_lenders" ADD CONSTRAINT "credit_direct_deal_lenders_lender_id_credit_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."credit_lenders"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_direct_deal_lenders" ADD CONSTRAINT "credit_direct_deal_lenders_updated_by_credit_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_direct_deals" ADD CONSTRAINT "credit_direct_deals_created_by_credit_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_direct_deals" ADD CONSTRAINT "credit_direct_deals_updated_by_credit_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_documents" ADD CONSTRAINT "credit_documents_borrower_id_credit_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."credit_borrowers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_documents" ADD CONSTRAINT "credit_documents_diligence_item_id_credit_diligence_items_id_fk" FOREIGN KEY ("diligence_item_id") REFERENCES "public"."credit_diligence_items"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_documents" ADD CONSTRAINT "credit_documents_uploaded_by_credit_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_intake_files" ADD CONSTRAINT "credit_intake_files_submission_id_credit_intake_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."credit_intake_submissions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_intake_files" ADD CONSTRAINT "credit_intake_files_uploaded_by_credit_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_intake_submissions" ADD CONSTRAINT "credit_intake_submissions_partner_id_credit_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."credit_partners"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_intake_submissions" ADD CONSTRAINT "credit_intake_submissions_borrower_id_credit_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."credit_borrowers"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_intake_submissions" ADD CONSTRAINT "credit_intake_submissions_created_by_credit_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_intake_submissions" ADD CONSTRAINT "credit_intake_submissions_updated_by_credit_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_lender_instruments" ADD CONSTRAINT "credit_lender_instruments_lender_id_credit_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."credit_lenders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_lender_instruments" ADD CONSTRAINT "credit_lender_instruments_instrument_id_credit_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."credit_instruments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_lender_reviews" ADD CONSTRAINT "credit_lender_reviews_lender_id_credit_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."credit_lenders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_lender_reviews" ADD CONSTRAINT "credit_lender_reviews_borrower_id_credit_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."credit_borrowers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_lender_reviews" ADD CONSTRAINT "credit_lender_reviews_updated_by_credit_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_lender_security_levels" ADD CONSTRAINT "credit_lender_security_levels_lender_id_credit_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."credit_lenders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_lender_security_levels" ADD CONSTRAINT "credit_lender_security_levels_security_level_id_credit_security_levels_id_fk" FOREIGN KEY ("security_level_id") REFERENCES "public"."credit_security_levels"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_lender_segment_targets" ADD CONSTRAINT "credit_lender_segment_targets_lender_id_credit_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."credit_lenders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_lender_segment_targets" ADD CONSTRAINT "credit_lender_segment_targets_segment_id_credit_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."credit_segments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_outreach_emails" ADD CONSTRAINT "credit_outreach_emails_prospect_id_credit_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."credit_prospects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_outreach_emails" ADD CONSTRAINT "credit_outreach_emails_created_by_credit_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_outreach_templates" ADD CONSTRAINT "credit_outreach_templates_updated_by_credit_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_prospect_settings" ADD CONSTRAINT "credit_prospect_settings_updated_by_credit_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_prospects" ADD CONSTRAINT "credit_prospects_borrower_id_credit_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."credit_borrowers"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_raise_economics" ADD CONSTRAINT "credit_raise_economics_raise_id_credit_raises_id_fk" FOREIGN KEY ("raise_id") REFERENCES "public"."credit_raises"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_raise_terms_history" ADD CONSTRAINT "credit_raise_terms_history_raise_id_credit_raises_id_fk" FOREIGN KEY ("raise_id") REFERENCES "public"."credit_raises"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_raise_terms_history" ADD CONSTRAINT "credit_raise_terms_history_instrument_id_credit_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."credit_instruments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_raise_terms_history" ADD CONSTRAINT "credit_raise_terms_history_segment_id_credit_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."credit_segments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_raise_terms_history" ADD CONSTRAINT "credit_raise_terms_history_security_level_id_credit_security_levels_id_fk" FOREIGN KEY ("security_level_id") REFERENCES "public"."credit_security_levels"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_raise_terms_history" ADD CONSTRAINT "credit_raise_terms_history_changed_by_credit_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_raises" ADD CONSTRAINT "credit_raises_borrower_id_credit_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."credit_borrowers"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_raises" ADD CONSTRAINT "credit_raises_instrument_id_credit_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."credit_instruments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_raises" ADD CONSTRAINT "credit_raises_segment_id_credit_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."credit_segments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_raises" ADD CONSTRAINT "credit_raises_security_level_id_credit_security_levels_id_fk" FOREIGN KEY ("security_level_id") REFERENCES "public"."credit_security_levels"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_raises" ADD CONSTRAINT "credit_raises_created_by_credit_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."credit_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_sessions" ADD CONSTRAINT "credit_sessions_user_id_credit_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."credit_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_users" ADD CONSTRAINT "credit_users_lender_id_credit_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."credit_lenders"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_users" ADD CONSTRAINT "credit_users_partner_id_credit_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."credit_partners"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "credit_activity_entity_idx" ON "credit_activity_log" USING btree ("entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX "credit_activity_created_idx" ON "credit_activity_log" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "credit_allocation_movements_lender_idx" ON "credit_allocation_movements" USING btree ("lender_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "credit_allocations_unique" ON "credit_allocations" USING btree ("raise_id","lender_id");
--> statement-breakpoint
CREATE INDEX "credit_approvals_status_idx" ON "credit_approvals" USING btree ("status","requested_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "credit_borrower_financials_unique" ON "credit_borrower_financials" USING btree ("borrower_id","period_end");
--> statement-breakpoint
CREATE INDEX "credit_deal_messages_thread_idx" ON "credit_deal_messages" USING btree ("raise_id","lender_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "credit_deal_shares_unique" ON "credit_deal_shares" USING btree ("raise_id","lender_id");
--> statement-breakpoint
CREATE INDEX "credit_deal_shares_lender_idx" ON "credit_deal_shares" USING btree ("lender_id");
--> statement-breakpoint
CREATE INDEX "credit_diligence_items_borrower_idx" ON "credit_diligence_items" USING btree ("borrower_id");
--> statement-breakpoint
CREATE INDEX "credit_l1_history_borrower_idx" ON "credit_diligence_l1_history" USING btree ("borrower_id","decided_at");
--> statement-breakpoint
CREATE INDEX "credit_direct_deal_files_deal_idx" ON "credit_direct_deal_files" USING btree ("deal_id");
--> statement-breakpoint
CREATE INDEX "credit_direct_deal_lenders_deal_idx" ON "credit_direct_deal_lenders" USING btree ("deal_id");
--> statement-breakpoint
CREATE INDEX "credit_direct_deals_stage_idx" ON "credit_direct_deals" USING btree ("stage","updated_at");
--> statement-breakpoint
CREATE INDEX "credit_documents_borrower_idx" ON "credit_documents" USING btree ("borrower_id");
--> statement-breakpoint
CREATE INDEX "credit_intake_files_submission_idx" ON "credit_intake_files" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX "credit_intake_submissions_partner_idx" ON "credit_intake_submissions" USING btree ("partner_id","updated_at");
--> statement-breakpoint
CREATE INDEX "credit_intake_submissions_status_idx" ON "credit_intake_submissions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "credit_intake_submissions_ip_idx" ON "credit_intake_submissions" USING btree ("ip","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "credit_lender_reviews_unique" ON "credit_lender_reviews" USING btree ("lender_id","borrower_id");
--> statement-breakpoint
CREATE INDEX "credit_login_codes_email_idx" ON "credit_login_codes" USING btree ("email","created_at");
--> statement-breakpoint
CREATE INDEX "credit_outreach_emails_prospect_idx" ON "credit_outreach_emails" USING btree ("prospect_id","created_at");
--> statement-breakpoint
CREATE INDEX "credit_outreach_emails_queue_idx" ON "credit_outreach_emails" USING btree ("status","scheduled_for");
--> statement-breakpoint
CREATE INDEX "credit_prospects_status_idx" ON "credit_prospects" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "credit_prospects_layer_idx" ON "credit_prospects" USING btree ("layer","classification");
--> statement-breakpoint
CREATE INDEX "credit_prospects_name_idx" ON "credit_prospects" USING btree ("name");
--> statement-breakpoint
CREATE INDEX "credit_prospects_state_idx" ON "credit_prospects" USING btree ("state");
--> statement-breakpoint
CREATE INDEX "credit_prospects_aum_idx" ON "credit_prospects" USING btree ("aum_cr");
--> statement-breakpoint
CREATE INDEX "credit_prospects_rating_idx" ON "credit_prospects" USING btree ("rating_grade");
--> statement-breakpoint
CREATE UNIQUE INDEX "credit_raise_terms_history_unique" ON "credit_raise_terms_history" USING btree ("raise_id","version");
--> statement-breakpoint
CREATE INDEX "credit_raises_borrower_idx" ON "credit_raises" USING btree ("borrower_id","cycle_start");
--> statement-breakpoint
CREATE INDEX "credit_sessions_user_idx" ON "credit_sessions" USING btree ("user_id");
--> statement-breakpoint
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'credit_app') then
    create role credit_app nologin nobypassrls;
  end if;
end $$;
--> statement-breakpoint
grant credit_app to current_user;
--> statement-breakpoint
grant usage on schema public to credit_app;
--> statement-breakpoint
create or replace function credit_app_role() returns text language sql stable as
$$ select coalesce(current_setting('app.role', true), '') $$;
--> statement-breakpoint
create or replace function credit_app_lender_id() returns uuid language sql stable as
$$ select nullif(current_setting('app.lender_id', true), '')::uuid $$;
--> statement-breakpoint
create or replace function credit_app_is_admin() returns boolean language sql stable as
$$ select credit_app_role() = 'admin' $$;
--> statement-breakpoint
create or replace function credit_app_is_lender() returns boolean language sql stable as
$$ select credit_app_role() = 'lender' and credit_app_lender_id() is not null $$;
--> statement-breakpoint
create or replace function credit_app_partner_id() returns uuid language sql stable as
$$ select nullif(current_setting('app.partner_id', true), '')::uuid $$;
--> statement-breakpoint
create or replace function credit_app_is_partner() returns boolean language sql stable as
$$ select credit_app_role() = 'partner' and credit_app_partner_id() is not null $$;
--> statement-breakpoint
create or replace function credit_app_apply_token() returns text language sql stable as
$$ select nullif(current_setting('app.apply_token', true), '') $$;
--> statement-breakpoint
create or replace function credit_app_is_applicant() returns boolean language sql stable as
$$ select credit_app_role() = 'applicant' and credit_app_apply_token() is not null $$;
--> statement-breakpoint
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'credit_app') then
    execute 'grant usage on schema public to credit_app';
  end if;
end $$;
--> statement-breakpoint
create or replace function _credit_reset_policies(t text) returns void language plpgsql as $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
    execute format('drop policy %I on %I', p.policyname, t);
  end loop;
  execute format('alter table %I enable row level security', t);
end $$;
--> statement-breakpoint
select _credit_reset_policies('credit_segments');
--> statement-breakpoint
create policy admin_all on credit_segments for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_read on credit_segments for select using (credit_app_is_lender());
--> statement-breakpoint
select _credit_reset_policies('credit_security_levels');
--> statement-breakpoint
create policy admin_all on credit_security_levels for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_read on credit_security_levels for select using (credit_app_is_lender());
--> statement-breakpoint
select _credit_reset_policies('credit_checklist_template');
--> statement-breakpoint
create policy admin_all on credit_checklist_template for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
select _credit_reset_policies('credit_lenders');
--> statement-breakpoint
create policy admin_all on credit_lenders for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_own on credit_lenders for select using (credit_app_is_lender() and id = credit_app_lender_id());
--> statement-breakpoint
select _credit_reset_policies('credit_lender_segment_targets');
--> statement-breakpoint
create policy admin_all on credit_lender_segment_targets for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_own on credit_lender_segment_targets for select using (credit_app_is_lender() and lender_id = credit_app_lender_id());
--> statement-breakpoint
select _credit_reset_policies('credit_lender_security_levels');
--> statement-breakpoint
create policy admin_all on credit_lender_security_levels for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_own on credit_lender_security_levels for select using (credit_app_is_lender() and lender_id = credit_app_lender_id());
--> statement-breakpoint
select _credit_reset_policies('credit_users');
--> statement-breakpoint
create policy admin_all on credit_users for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_colleagues on credit_users for select using (credit_app_is_lender() and lender_id = credit_app_lender_id());
--> statement-breakpoint
create policy auth_read on credit_users for select using (credit_app_role() = 'auth');
--> statement-breakpoint
create policy auth_update on credit_users for update using (credit_app_role() = 'auth') with check (credit_app_role() = 'auth');
--> statement-breakpoint
select _credit_reset_policies('credit_sessions');
--> statement-breakpoint
create policy auth_all on credit_sessions for all using (credit_app_role() = 'auth') with check (credit_app_role() = 'auth');
--> statement-breakpoint
select _credit_reset_policies('credit_login_codes');
--> statement-breakpoint
create policy auth_all on credit_login_codes for all using (credit_app_role() = 'auth') with check (credit_app_role() = 'auth');
--> statement-breakpoint
select _credit_reset_policies('credit_deal_shares');
--> statement-breakpoint
create policy admin_all on credit_deal_shares for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_own on credit_deal_shares for select
  using (credit_app_is_lender() and lender_id = credit_app_lender_id() and revoked_at is null);
--> statement-breakpoint
select _credit_reset_policies('credit_raises');
--> statement-breakpoint
create policy admin_all on credit_raises for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_shared on credit_raises for select using (
  credit_app_is_lender() and status <> 'draft' and exists (
    select 1 from credit_deal_shares s
    where s.raise_id = credit_raises.id and s.lender_id = credit_app_lender_id() and s.revoked_at is null
  )
);
--> statement-breakpoint
select _credit_reset_policies('credit_raise_economics');
--> statement-breakpoint
create policy admin_all on credit_raise_economics for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
select _credit_reset_policies('credit_allocations');
--> statement-breakpoint
create policy admin_all on credit_allocations for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_own_read on credit_allocations for select using (credit_app_is_lender() and lender_id = credit_app_lender_id());
--> statement-breakpoint
create policy lender_own_insert on credit_allocations for insert with check (
  credit_app_is_lender() and lender_id = credit_app_lender_id() and status in ('interested', 'withdrawn')
  and exists (select 1 from credit_raises r where r.id = credit_allocations.raise_id and r.status = 'open')
);
--> statement-breakpoint
create policy lender_own_update on credit_allocations for update
  using (credit_app_is_lender() and lender_id = credit_app_lender_id() and status in ('interested', 'withdrawn'))
  with check (credit_app_is_lender() and lender_id = credit_app_lender_id() and status in ('interested', 'withdrawn'));
--> statement-breakpoint
create or replace function credit_app_lender_sees_borrower(b uuid) returns boolean language sql stable as $$
  select credit_app_is_lender() and exists (
    select 1 from credit_raises r
    join credit_deal_shares s on s.raise_id = r.id
    where r.borrower_id = b and r.status <> 'draft'
      and s.lender_id = credit_app_lender_id() and s.revoked_at is null
  )
$$;
--> statement-breakpoint
select _credit_reset_policies('credit_borrowers');
--> statement-breakpoint
create policy admin_all on credit_borrowers for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_shared on credit_borrowers for select using (credit_app_lender_sees_borrower(id));
--> statement-breakpoint
select _credit_reset_policies('credit_borrower_segments');
--> statement-breakpoint
create policy admin_all on credit_borrower_segments for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_shared on credit_borrower_segments for select using (credit_app_lender_sees_borrower(borrower_id));
--> statement-breakpoint
select _credit_reset_policies('credit_diligence_l1');
--> statement-breakpoint
create policy admin_all on credit_diligence_l1 for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_shared on credit_diligence_l1 for select using (credit_app_lender_sees_borrower(borrower_id));
--> statement-breakpoint
select _credit_reset_policies('credit_diligence_items');
--> statement-breakpoint
create policy admin_all on credit_diligence_items for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_shared on credit_diligence_items for select using (credit_app_lender_sees_borrower(borrower_id));
--> statement-breakpoint
select _credit_reset_policies('credit_documents');
--> statement-breakpoint
create policy admin_all on credit_documents for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_shared on credit_documents for select using (credit_app_lender_sees_borrower(borrower_id));
--> statement-breakpoint
select _credit_reset_policies('credit_lender_reviews');
--> statement-breakpoint
create policy admin_all on credit_lender_reviews for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_own_read on credit_lender_reviews for select using (credit_app_is_lender() and lender_id = credit_app_lender_id());
--> statement-breakpoint
create policy lender_own_write on credit_lender_reviews for insert
  with check (credit_app_is_lender() and lender_id = credit_app_lender_id() and credit_app_lender_sees_borrower(borrower_id));
--> statement-breakpoint
create policy lender_own_update on credit_lender_reviews for update
  using (credit_app_is_lender() and lender_id = credit_app_lender_id())
  with check (credit_app_is_lender() and lender_id = credit_app_lender_id());
--> statement-breakpoint
select _credit_reset_policies('credit_activity_log');
--> statement-breakpoint
create policy admin_all on credit_activity_log for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_insert on credit_activity_log for insert
  with check (credit_app_is_lender() and lender_id = credit_app_lender_id() and actor_role in ('lender_admin', 'lender_viewer'));
--> statement-breakpoint
create policy auth_insert on credit_activity_log for insert with check (credit_app_role() = 'auth');
--> statement-breakpoint
create policy intake_insert on credit_activity_log for insert with check (credit_app_role() = 'intake' and actor_user_id is null);
--> statement-breakpoint
select _credit_reset_policies('credit_access_requests');
--> statement-breakpoint
create policy admin_all on credit_access_requests for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy intake_insert on credit_access_requests for insert with check (credit_app_role() = 'intake' and status = 'new');
--> statement-breakpoint
select _credit_reset_policies('credit_diligence_l1_history');
--> statement-breakpoint
create policy admin_all on credit_diligence_l1_history for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_shared on credit_diligence_l1_history for select using (credit_app_lender_sees_borrower(borrower_id));
--> statement-breakpoint
select _credit_reset_policies('credit_raise_terms_history');
--> statement-breakpoint
create policy admin_all on credit_raise_terms_history for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_shared on credit_raise_terms_history for select using (
  credit_app_is_lender() and exists (
    select 1 from credit_raises r join credit_deal_shares s on s.raise_id = r.id
    where r.id = credit_raise_terms_history.raise_id and r.status <> 'draft'
      and s.lender_id = credit_app_lender_id() and s.revoked_at is null
  )
);
--> statement-breakpoint
select _credit_reset_policies('credit_deal_messages');
--> statement-breakpoint
create policy admin_all on credit_deal_messages for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_own_read on credit_deal_messages for select using (
  credit_app_is_lender() and lender_id = credit_app_lender_id() and exists (
    select 1 from credit_deal_shares s where s.raise_id = credit_deal_messages.raise_id and s.lender_id = credit_app_lender_id() and s.revoked_at is null
  )
);
--> statement-breakpoint
create policy lender_own_insert on credit_deal_messages for insert with check (
  credit_app_is_lender() and lender_id = credit_app_lender_id() and author_side = 'lender'
  and author_user_id = nullif(current_setting('app.user_id', true), '')::uuid
  and exists (
    select 1 from credit_raises r join credit_deal_shares s on s.raise_id = r.id
    where r.id = credit_deal_messages.raise_id and r.status <> 'draft'
      and s.lender_id = credit_app_lender_id() and s.revoked_at is null
  )
);
--> statement-breakpoint
create or replace function credit_intake_recent_count(p_ip text, p_since timestamptz) returns integer
language plpgsql volatile security definer set search_path = public as
$$
declare
  prev text := current_setting('app.role', true);
  n integer;
begin
  perform set_config('app.role', 'admin', true);
  select count(*)::int into n from credit_access_requests where ip = p_ip and created_at > p_since;
  perform set_config('app.role', coalesce(prev, ''), true);
  return n;
end
$$;
--> statement-breakpoint
revoke all on function credit_intake_recent_count(text, timestamptz) from public;
--> statement-breakpoint
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'credit_app') then
    execute 'grant execute on function credit_intake_recent_count(text, timestamptz) to credit_app';
  end if;
end $$;
--> statement-breakpoint
select _credit_reset_policies('credit_instruments');
--> statement-breakpoint
create policy admin_all on credit_instruments for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_read on credit_instruments for select using (credit_app_is_lender());
--> statement-breakpoint
select _credit_reset_policies('credit_lender_instruments');
--> statement-breakpoint
create policy admin_all on credit_lender_instruments for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_own on credit_lender_instruments for select using (credit_app_is_lender() and lender_id = credit_app_lender_id());
--> statement-breakpoint
select _credit_reset_policies('credit_borrower_financials');
--> statement-breakpoint
create policy admin_all on credit_borrower_financials for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_shared on credit_borrower_financials for select using (credit_app_lender_sees_borrower(borrower_id));
--> statement-breakpoint
select _credit_reset_policies('credit_allocation_movements');
--> statement-breakpoint
create policy admin_all on credit_allocation_movements for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy lender_own on credit_allocation_movements for select using (credit_app_is_lender() and lender_id = credit_app_lender_id());
--> statement-breakpoint
select _credit_reset_policies('credit_approvals');
--> statement-breakpoint
create policy admin_all on credit_approvals for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
select _credit_reset_policies('credit_prospects');
--> statement-breakpoint
create policy admin_all on credit_prospects for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy outreach_read on credit_prospects for select using (credit_app_role() = 'outreach');
--> statement-breakpoint
create policy outreach_mark on credit_prospects for update using (credit_app_role() = 'outreach') with check (credit_app_role() = 'outreach');
--> statement-breakpoint
select _credit_reset_policies('credit_prospect_settings');
--> statement-breakpoint
create policy admin_all on credit_prospect_settings for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy partner_read on credit_prospect_settings for select using (credit_app_is_partner() or credit_app_is_applicant());
--> statement-breakpoint
select _credit_reset_policies('credit_outreach_templates');
--> statement-breakpoint
create policy admin_all on credit_outreach_templates for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
select _credit_reset_policies('credit_outreach_emails');
--> statement-breakpoint
create policy admin_all on credit_outreach_emails for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy outreach_queue on credit_outreach_emails for select
  using (credit_app_role() = 'outreach' and status in ('queued', 'sending', 'sent', 'failed') and scheduled_for > now() - interval '2 days');
--> statement-breakpoint
create policy outreach_update on credit_outreach_emails for update
  using (credit_app_role() = 'outreach' and status in ('queued', 'sending'))
  with check (credit_app_role() = 'outreach' and status in ('sending', 'sent', 'failed'));
--> statement-breakpoint
create policy outreach_insert on credit_activity_log for insert with check (credit_app_role() = 'outreach' and actor_user_id is null);
--> statement-breakpoint
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'credit_app') then
  end if;
end $$;
--> statement-breakpoint
select _credit_reset_policies('credit_partners');
--> statement-breakpoint
create policy admin_all on credit_partners for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy partner_own on credit_partners for select using (credit_app_is_partner() and id = credit_app_partner_id());
--> statement-breakpoint
create or replace function credit_app_partner_can_edit(s uuid) returns boolean language sql stable as $$
  select credit_app_is_partner() and exists (
    select 1 from credit_intake_submissions x where x.id = s and x.partner_id = credit_app_partner_id() and x.status in ('draft', 'needs_info')
  )
$$;
--> statement-breakpoint
select _credit_reset_policies('credit_intake_submissions');
--> statement-breakpoint
create policy admin_all on credit_intake_submissions for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy partner_read on credit_intake_submissions for select using (credit_app_is_partner() and partner_id = credit_app_partner_id());
--> statement-breakpoint
create policy partner_insert on credit_intake_submissions for insert
  with check (credit_app_is_partner() and partner_id = credit_app_partner_id() and status = 'draft' and borrower_id is null);
--> statement-breakpoint
create policy partner_update on credit_intake_submissions for update
  using (credit_app_is_partner() and partner_id = credit_app_partner_id() and status in ('draft', 'needs_info'))
  with check (credit_app_is_partner() and partner_id = credit_app_partner_id() and status in ('draft', 'needs_info', 'submitted') and borrower_id is null);
--> statement-breakpoint
create policy partner_delete on credit_intake_submissions for delete
  using (credit_app_is_partner() and partner_id = credit_app_partner_id() and status = 'draft');
--> statement-breakpoint
select _credit_reset_policies('credit_intake_files');
--> statement-breakpoint
create policy admin_all on credit_intake_files for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
create policy partner_read on credit_intake_files for select using (
  credit_app_is_partner() and exists (select 1 from credit_intake_submissions x where x.id = credit_intake_files.submission_id and x.partner_id = credit_app_partner_id())
);
--> statement-breakpoint
create policy partner_insert on credit_intake_files for insert with check (credit_app_partner_can_edit(submission_id) and uploaded_by = nullif(current_setting('app.user_id', true), '')::uuid);
--> statement-breakpoint
create policy partner_update on credit_intake_files for update using (credit_app_partner_can_edit(submission_id)) with check (credit_app_partner_can_edit(submission_id));
--> statement-breakpoint
create policy partner_delete on credit_intake_files for delete using (credit_app_partner_can_edit(submission_id));
--> statement-breakpoint
create policy partner_insert on credit_activity_log for insert
  with check (credit_app_is_partner() and actor_role = 'partner' and actor_user_id = nullif(current_setting('app.user_id', true), '')::uuid);
--> statement-breakpoint
create or replace function credit_app_applicant_can_edit(s uuid) returns boolean language sql stable as $$
  select credit_app_is_applicant() and exists (
    select 1 from credit_intake_submissions x where x.id = s and x.source = 'public'
      and x.access_token_hash = credit_app_apply_token() and x.status in ('draft', 'needs_info')
  )
$$;
--> statement-breakpoint
create policy applicant_read on credit_intake_submissions for select
  using (credit_app_is_applicant() and source = 'public' and access_token_hash = credit_app_apply_token());
--> statement-breakpoint
create policy applicant_insert on credit_intake_submissions for insert
  with check (credit_app_is_applicant() and source = 'public' and partner_id is null and borrower_id is null
    and status = 'draft' and access_token_hash = credit_app_apply_token());
--> statement-breakpoint
create policy applicant_update on credit_intake_submissions for update
  using (credit_app_is_applicant() and source = 'public' and access_token_hash = credit_app_apply_token() and status in ('draft', 'needs_info'))
  with check (credit_app_is_applicant() and source = 'public' and access_token_hash = credit_app_apply_token() and partner_id is null
    and borrower_id is null and status in ('draft', 'needs_info', 'submitted'));
--> statement-breakpoint
create policy applicant_read on credit_intake_files for select using (
  credit_app_is_applicant() and exists (select 1 from credit_intake_submissions x where x.id = credit_intake_files.submission_id
    and x.source = 'public' and x.access_token_hash = credit_app_apply_token())
);
--> statement-breakpoint
create policy applicant_insert on credit_intake_files for insert with check (credit_app_applicant_can_edit(submission_id) and uploaded_by is null);
--> statement-breakpoint
create policy applicant_update on credit_intake_files for update using (credit_app_applicant_can_edit(submission_id)) with check (credit_app_applicant_can_edit(submission_id));
--> statement-breakpoint
create policy applicant_delete on credit_intake_files for delete using (credit_app_applicant_can_edit(submission_id));
--> statement-breakpoint
create policy applicant_insert on credit_activity_log for insert with check (credit_app_is_applicant() and actor_role = 'applicant' and actor_user_id is null);
--> statement-breakpoint
create or replace function credit_apply_recent_count(p_ip text, p_since timestamptz) returns integer
language plpgsql volatile security definer set search_path = public as
$$
declare
  prev text := current_setting('app.role', true);
  n integer;
begin
  perform set_config('app.role', 'admin', true);
  select count(*)::int into n from credit_intake_submissions where source = 'public' and ip = p_ip and created_at > p_since;
  perform set_config('app.role', coalesce(prev, ''), true);
  return n;
end
$$;
--> statement-breakpoint
revoke all on function credit_apply_recent_count(text, timestamptz) from public;
--> statement-breakpoint
create or replace function credit_registry_lookup(q text)
returns table (name text, cin text, rbi_reg_no text, state text, regional_office text, classification text, layer text)
language plpgsql stable security definer set search_path = public as
$$
declare
  prev text := current_setting('app.role', true);
  t text := btrim(coalesce(q, ''));
begin
  perform set_config('app.role', 'admin', true);
  if t ~* '^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$' then
    return query select p.name, p.cin, p.rbi_reg_no, p.state, p.regional_office, p.classification, p.layer
      from credit_prospects p where p.cin = upper(t) limit 1;
  elsif length(t) >= 3 then
    return query select p.name, p.cin, p.rbi_reg_no, p.state, p.regional_office, p.classification, p.layer
      from credit_prospects p where p.name ilike '%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      order by (p.name ilike replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%') desc, length(p.name), p.name
      limit 8;
  end if;
  perform set_config('app.role', coalesce(prev, ''), true);
end
$$;
--> statement-breakpoint
revoke all on function credit_registry_lookup(text) from public;
--> statement-breakpoint
create or replace function credit_applicant_signup(p_email text, p_name text) returns void
language plpgsql volatile security definer set search_path = public as
$$
declare
  prev text := current_setting('app.role', true);
begin
  perform set_config('app.role', 'admin', true);
  insert into credit_users (email, name, role) values (lower(btrim(p_email)), left(btrim(p_name), 200), 'applicant')
    on conflict (email) do nothing;
  perform set_config('app.role', coalesce(prev, ''), true);
end
$$;
--> statement-breakpoint
revoke all on function credit_applicant_signup(text, text) from public;
--> statement-breakpoint
create or replace function credit_app_user_email() returns text language sql stable as
$$ select nullif(current_setting('app.user_email', true), '') $$;
--> statement-breakpoint
create policy account_read on credit_intake_submissions for select
  using (credit_app_role() = 'applicant_account' and credit_app_user_email() is not null and source = 'public' and lower(submitter_email) = credit_app_user_email());
--> statement-breakpoint
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'credit_app') then
    execute 'grant execute on function credit_apply_recent_count(text, timestamptz) to credit_app';
    execute 'grant execute on function credit_registry_lookup(text) to credit_app';
    execute 'grant execute on function credit_applicant_signup(text, text) to credit_app';
  end if;
end $$;
--> statement-breakpoint
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'credit_app') then
  end if;
end $$;
--> statement-breakpoint
select _credit_reset_policies('credit_direct_deals');
--> statement-breakpoint
create policy admin_all on credit_direct_deals for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
select _credit_reset_policies('credit_direct_deal_lenders');
--> statement-breakpoint
create policy admin_all on credit_direct_deal_lenders for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
select _credit_reset_policies('credit_direct_deal_files');
--> statement-breakpoint
create policy admin_all on credit_direct_deal_files for all using (credit_app_is_admin()) with check (credit_app_is_admin());
--> statement-breakpoint
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'credit_app') then
  end if;
end $$;
--> statement-breakpoint
select _credit_reset_policies('credit_blobs');
--> statement-breakpoint
grant select, insert, update, delete on credit_access_requests, credit_activity_log, credit_allocation_movements, credit_allocations, credit_approvals, credit_blobs, credit_borrower_financials, credit_borrower_segments, credit_borrowers, credit_checklist_template, credit_deal_messages, credit_deal_shares, credit_diligence_items, credit_diligence_l1, credit_diligence_l1_history, credit_direct_deal_files, credit_direct_deal_lenders, credit_direct_deals, credit_documents, credit_instruments, credit_intake_files, credit_intake_submissions, credit_lender_instruments, credit_lender_reviews, credit_lender_security_levels, credit_lender_segment_targets, credit_lenders, credit_login_codes, credit_outreach_emails, credit_outreach_templates, credit_partners, credit_prospect_settings, credit_prospects, credit_raise_economics, credit_raise_terms_history, credit_raises, credit_security_levels, credit_segments, credit_sessions, credit_users to credit_app;
--> statement-breakpoint
do $$ declare s record; begin
  for s in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind = 'S' and n.nspname = 'public' and c.relname like 'credit\_%' loop
    execute format('grant usage, select on sequence %I to credit_app', s.relname);
  end loop;
end $$;
--> statement-breakpoint
drop function if exists _credit_reset_policies(text);
