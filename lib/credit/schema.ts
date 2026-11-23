import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  boolean,
  date,
  jsonb,
  bigserial,
  primaryKey,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/*
 * Money is stored in rupees as numeric(18,2). Rates are stored as percent per annum, numeric(6,2).
 * No commercial values (rates, ticket sizes, fees) are hard-coded anywhere: all are entered by the
 * platform team per lender / per raise.
 */

export const userRole = pgEnum("credit_user_role", ["platform_admin", "lender_admin", "lender_viewer", "partner", "applicant"]);
export const sessionStage = pgEnum("credit_session_stage", ["totp_enroll", "totp_verify", "active"]);
export const borrowerStatus = pgEnum("credit_borrower_status", ["prospect", "onboarding", "active", "inactive"]);
// Level 1 = platform screening. Level 2 = the lender's own diligence (one per lender per borrower).
export const diligenceStatus = pgEnum("credit_diligence_status", [
  "not_started",
  "in_review",
  "approved",
  "rejected",
  "refresh_required",
]);
export const itemStatus = pgEnum("credit_item_status", ["pending", "received", "accepted", "rejected"]);
export const raiseStatus = pgEnum("credit_raise_status", ["draft", "open", "funded", "closed", "cancelled"]);
export const allocationStatus = pgEnum("credit_allocation_status", [
  "interested",
  "sanctioned",
  "disbursed",
  "declined",
  "withdrawn",
]);
export const accessSide = pgEnum("credit_access_side", ["borrower", "lender"]);
export const accessRequestStatus = pgEnum("credit_access_request_status", ["new", "contacted", "approved", "declined"]);
/** How often a borrower draws down: each raise covers one period of this length. Keep in sync with src/server/cycles.ts. */
export const drawdownCycle = pgEnum("credit_drawdown_cycle", ["monthly", "quarterly", "yearly"]);

const ts = (name: string) => timestamp(name, { withTimezone: true });
const money = (name: string) => numeric(name, { precision: 18, scale: 2 });
const rate = (name: string) => numeric(name, { precision: 6, scale: 2 });

// ---------- Reference lists (managed by admins) ----------

/** Loan-book segments, e.g. the auto-loan segment a lender wants exposure to. */
export const segments = pgTable("credit_segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
});

/** Security levels for raises, e.g. more secure paper vs less secure paper. rank: lower = more secure. */
export const securityLevels = pgTable("credit_security_levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  rank: integer("rank").notNull(),
});

/** Instruments a raise can be issued as (e.g. NCDs). Lender mandates differ by instrument. */
export const instruments = pgTable("credit_instruments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
});

// ---------- Lenders ----------

export const lenders = pgTable(
  "credit_lenders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    minTicket: money("min_ticket"),
    maxTicket: money("max_ticket"),
    minRate: rate("min_rate"),
    maxRate: rate("max_rate"),
    thesisNotes: text("thesis_notes"),
    active: boolean("active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("credit_lender_ticket_order", sql`${t.minTicket} is null or ${t.maxTicket} is null or ${t.minTicket} <= ${t.maxTicket}`),
    check("credit_lender_rate_order", sql`${t.minRate} is null or ${t.maxRate} is null or ${t.minRate} <= ${t.maxRate}`),
  ],
);

/** Lender thesis: which segments they want exposure to, with an optional exposure target in rupees. */
export const lenderSegmentTargets = pgTable(
  "credit_lender_segment_targets",
  {
    lenderId: uuid("lender_id").notNull().references(() => lenders.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id").notNull().references(() => segments.id, { onDelete: "cascade" }),
    targetExposure: money("target_exposure"),
  },
  (t) => [primaryKey({ columns: [t.lenderId, t.segmentId] })],
);

/** Lender risk appetite: which security levels they will take. */
export const lenderSecurityLevels = pgTable(
  "credit_lender_security_levels",
  {
    lenderId: uuid("lender_id").notNull().references(() => lenders.id, { onDelete: "cascade" }),
    securityLevelId: uuid("security_level_id").notNull().references(() => securityLevels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.lenderId, t.securityLevelId] })],
);

/** Lender mandate: which instruments the lender will take. */
export const lenderInstruments = pgTable(
  "credit_lender_instruments",
  {
    lenderId: uuid("lender_id").notNull().references(() => lenders.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id").notNull().references(() => instruments.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.lenderId, t.instrumentId] })],
);

// ---------- Users & auth ----------

export const users = pgTable(
  "credit_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    role: userRole("role").notNull(),
    lenderId: uuid("lender_id").references(() => lenders.id, { onDelete: "restrict" }),
    /** Partners (aggregators who introduce borrower NBFCs) belong to a partner firm instead of a lender. */
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "restrict" }),
    totpSecret: text("totp_secret"),
    totpEnabledAt: ts("totp_enabled_at"),
    disabledAt: ts("disabled_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "user_role_org",
      // role::text: the 'partner' enum value is added in the same migration, and Postgres won't compare a new
      // enum value inside the transaction that adds it.
      sql`(${t.role}::text = 'platform_admin' and ${t.lenderId} is null and ${t.partnerId} is null)
        or (${t.role}::text = 'partner' and ${t.partnerId} is not null and ${t.lenderId} is null)
        or (${t.role}::text = 'applicant' and ${t.partnerId} is null and ${t.lenderId} is null)
        or (${t.role}::text in ('lender_admin', 'lender_viewer') and ${t.lenderId} is not null and ${t.partnerId} is null)`,
    ),
    check("credit_user_email_lower", sql`${t.email} = lower(${t.email})`),
  ],
);

export const sessions = pgTable(
  "credit_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    stage: sessionStage("stage").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("credit_sessions_user_idx").on(t.userId)],
);

export const loginCodes = pgTable(
  "credit_login_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: ts("consumed_at"),
    ip: text("ip"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("credit_login_codes_email_idx").on(t.email, t.createdAt)],
);

// ---------- Borrowers & diligence ----------

export const borrowers = pgTable("credit_borrowers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  cin: text("cin"),
  rbiRegistration: text("rbi_registration"),
  city: text("city"),
  state: text("state"),
  status: borrowerStatus("status").notNull().default("prospect"),
  /** The borrower's drawdown cycle. New raises copy it; changing it later does not alter existing raises. */
  drawdownCycle: drawdownCycle("drawdown_cycle").notNull().default("monthly"),
  notes: text("notes"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const borrowerSegments = pgTable(
  "credit_borrower_segments",
  {
    borrowerId: uuid("borrower_id").notNull().references(() => borrowers.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id").notNull().references(() => segments.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.borrowerId, t.segmentId] })],
);

/** Quarterly financials (heavier data, updated each quarter rather than with every raise). */
export const borrowerFinancials = pgTable(
  "credit_borrower_financials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    borrowerId: uuid("borrower_id").notNull().references(() => borrowers.id, { onDelete: "cascade" }),
    /** Quarter-end date: 31 Mar, 30 Jun, 30 Sep or 31 Dec. */
    periodEnd: date("period_end").notNull(),
    aum: money("aum"),
    gnpaPct: rate("gnpa_pct"),
    /** Leverage as a multiple (e.g. debt to equity), entered as reported. */
    leverage: numeric("leverage", { precision: 8, scale: 2 }),
    enteredBy: uuid("entered_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("credit_borrower_financials_unique").on(t.borrowerId, t.periodEnd),
    check(
      "borrower_financials_quarter_end",
      sql`(extract(month from ${t.periodEnd}), extract(day from ${t.periodEnd})) in ((3,31),(6,30),(9,30),(12,31))`,
    ),
  ],
);

/** Default Level 1 checklist applied to new borrowers. Defined by the platform team. */
export const checklistTemplate = pgTable("credit_checklist_template", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  sort: integer("sort").notNull().default(0),
});

/** Level 1 diligence (platform screening): one row per borrower. Baseline once, refresh quarterly or on material change. */
export const diligenceL1 = pgTable("credit_diligence_l1", {
  borrowerId: uuid("borrower_id").primaryKey().references(() => borrowers.id, { onDelete: "cascade" }),
  status: diligenceStatus("status").notNull().default("not_started"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: ts("reviewed_at"),
  approvedAt: ts("approved_at"),
  refreshDueAt: ts("refresh_due_at"),
  notes: text("notes"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Every Level 1 decision (baseline, refresh, material change). Lenders on a shared raise see dates and outcomes, not notes. */
export const diligenceL1History = pgTable(
  "credit_diligence_l1_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    borrowerId: uuid("borrower_id").notNull().references(() => borrowers.id, { onDelete: "cascade" }),
    status: diligenceStatus("status").notNull(),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: ts("decided_at").notNull().defaultNow(),
  },
  (t) => [index("credit_l1_history_borrower_idx").on(t.borrowerId, t.decidedAt)],
);

export const diligenceItems = pgTable(
  "credit_diligence_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    borrowerId: uuid("borrower_id").notNull().references(() => borrowers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: itemStatus("status").notNull().default("pending"),
    reviewNote: text("review_note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: ts("reviewed_at"),
    sort: integer("sort").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("credit_diligence_items_borrower_idx").on(t.borrowerId)],
);

export const documents = pgTable(
  "credit_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    borrowerId: uuid("borrower_id").notNull().references(() => borrowers.id, { onDelete: "cascade" }),
    diligenceItemId: uuid("diligence_item_id").references(() => diligenceItems.id, { onDelete: "set null" }),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    /** Set when a newer file replaces this one (e.g. at a quarterly refresh). Kept for history, shown as an earlier version. */
    supersededAt: ts("superseded_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("credit_documents_borrower_idx").on(t.borrowerId)],
);

/** Level 2 diligence: the lender's own diligence on a borrower. Visible only to that lender and admins. */
export const lenderReviews = pgTable(
  "credit_lender_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lenderId: uuid("lender_id").notNull().references(() => lenders.id, { onDelete: "cascade" }),
    borrowerId: uuid("borrower_id").notNull().references(() => borrowers.id, { onDelete: "cascade" }),
    status: diligenceStatus("status").notNull().default("not_started"),
    notes: text("notes"),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("credit_lender_reviews_unique").on(t.lenderId, t.borrowerId)],
);

// ---------- Raises (funding proposals, one per drawdown period), sell-down ----------

/**
 * One funding proposal from one borrower for one period of its drawdown cycle (monthly, quarterly or yearly).
 * Parity: one security package, one set of terms and one lender rate for every lender in the raise.
 */
export const raises = pgTable(
  "credit_raises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    borrowerId: uuid("borrower_id").notNull().references(() => borrowers.id, { onDelete: "restrict" }),
    /** First day of the period's start month. */
    cycleStart: date("cycle_start").notNull(),
    /** Copied from the borrower's drawdown cycle when the raise is created; never rewritten afterwards. */
    cycle: drawdownCycle("cycle").notNull(),
    amount: money("amount").notNull(),
    lenderRate: rate("lender_rate"),
    instrumentId: uuid("instrument_id").references(() => instruments.id),
    /** Segment the funds go to; drives thesis matching and segment exposure. */
    segmentId: uuid("segment_id").references(() => segments.id),
    purpose: text("purpose"),
    securityLevelId: uuid("security_level_id").references(() => securityLevels.id),
    securityDescription: text("security_description"),
    terms: text("terms"),
    status: raiseStatus("status").notNull().default("draft"),
    /** Denormalised sum of sanctioned + disbursed allocations, so lenders can see fill without seeing other allocations. */
    filledAmount: money("filled_amount").notNull().default("0"),
    /** Bumped whenever a lender-facing term changes (amount, rate, security, terms). */
    termsVersion: integer("terms_version").notNull().default(1),
    openedAt: ts("opened_at"),
    closedAt: ts("closed_at"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("credit_raises_borrower_idx").on(t.borrowerId, t.cycleStart),
    check("credit_raise_amount_positive", sql`${t.amount} > 0`),
    check("credit_raise_cycle_first_of_month", sql`extract(day from ${t.cycleStart}) = 1`),
  ],
);

/** Admin-only economics. The borrower rate never reaches a lender: separate table, admin-only RLS policy. */
export const raiseEconomics = pgTable("credit_raise_economics", {
  raiseId: uuid("raise_id").primaryKey().references(() => raises.id, { onDelete: "cascade" }),
  borrowerRate: rate("borrower_rate"),
  /** The borrower's expected rate band for this raise. Borrower-side pricing, so admin-only like the borrower rate. */
  expectedRateMin: rate("expected_rate_min"),
  expectedRateMax: rate("expected_rate_max"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Snapshot of the lender-facing terms at each version. No borrower rate here: lenders on the raise may read it. */
export const raiseTermsHistory = pgTable(
  "credit_raise_terms_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    raiseId: uuid("raise_id").notNull().references(() => raises.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    amount: money("amount").notNull(),
    lenderRate: rate("lender_rate"),
    instrumentId: uuid("instrument_id").references(() => instruments.id),
    segmentId: uuid("segment_id").references(() => segments.id),
    purpose: text("purpose"),
    securityLevelId: uuid("security_level_id").references(() => securityLevels.id),
    securityDescription: text("security_description"),
    terms: text("terms"),
    changedBy: uuid("changed_by").references(() => users.id),
    changedAt: ts("changed_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("credit_raise_terms_history_unique").on(t.raiseId, t.version)],
);

/** Explicit grant: this lender may see this raise (and the borrower's Level 1 diligence). */
export const dealShares = pgTable(
  "credit_deal_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    raiseId: uuid("raise_id").notNull().references(() => raises.id, { onDelete: "cascade" }),
    lenderId: uuid("lender_id").notNull().references(() => lenders.id, { onDelete: "cascade" }),
    sharedBy: uuid("shared_by").references(() => users.id),
    sharedAt: ts("shared_at").notNull().defaultNow(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [uniqueIndex("credit_deal_shares_unique").on(t.raiseId, t.lenderId), index("credit_deal_shares_lender_idx").on(t.lenderId)],
);

/** One lender's part of a raise's sell-down. */
export const allocations = pgTable(
  "credit_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    raiseId: uuid("raise_id").notNull().references(() => raises.id, { onDelete: "cascade" }),
    lenderId: uuid("lender_id").notNull().references(() => lenders.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    status: allocationStatus("status").notNull().default("interested"),
    /** The raise's terms version the lender's latest indication was given against. */
    termsVersion: integer("terms_version"),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("credit_allocations_unique").on(t.raiseId, t.lenderId), check("credit_allocation_amount_positive", sql`${t.amount} > 0`)],
);

/** Money actually moved on an allocation. Disbursed = sum of disbursements; outstanding = disbursed - repayments. */
export const allocationMovements = pgTable(
  "credit_allocation_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    allocationId: uuid("allocation_id").notNull().references(() => allocations.id, { onDelete: "restrict" }),
    raiseId: uuid("raise_id").notNull().references(() => raises.id, { onDelete: "restrict" }),
    lenderId: uuid("lender_id").notNull().references(() => lenders.id, { onDelete: "restrict" }),
    kind: text("kind").notNull(), // 'disbursement' | 'repayment'
    amount: money("amount").notNull(),
    valueDate: date("value_date").notNull(),
    note: text("note"),
    enteredBy: uuid("entered_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("credit_allocation_movements_lender_idx").on(t.lenderId),
    check("credit_allocation_movements_kind", sql`${t.kind} in ('disbursement', 'repayment')`),
    check("credit_allocation_movements_amount_positive", sql`${t.amount} > 0`),
  ],
);

/**
 * Maker-checker: sharing a raise with lenders and sanctioning an allocation are requested by one admin and
 * carried out only when a different admin approves. The database refuses self-approval.
 */
export const approvals = pgTable(
  "credit_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(), // 'share' | 'sanction'
    raiseId: uuid("raise_id").notNull().references(() => raises.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"), // pending | approved | rejected | cancelled
    requestedBy: uuid("requested_by").notNull().references(() => users.id),
    requestedAt: ts("requested_at").notNull().defaultNow(),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: ts("decided_at"),
    decisionNote: text("decision_note"),
  },
  (t) => [
    index("credit_approvals_status_idx").on(t.status, t.requestedAt),
    check("credit_approvals_kind", sql`${t.kind} in ('share', 'sanction')`),
    check("credit_approvals_status", sql`${t.status} in ('pending', 'approved', 'rejected', 'cancelled')`),
    check("credit_approvals_no_self_approval", sql`${t.status} in ('pending', 'cancelled') or ${t.decidedBy} <> ${t.requestedBy}`),
  ],
);

/**
 * Private Q&A between the platform team and one lender on one raise. Each (raise, lender) pair is its own thread;
 * no lender ever sees another lender's thread.
 */
export const dealMessages = pgTable(
  "credit_deal_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    raiseId: uuid("raise_id").notNull().references(() => raises.id, { onDelete: "cascade" }),
    lenderId: uuid("lender_id").notNull().references(() => lenders.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => users.id),
    authorSide: text("author_side").notNull(), // 'platform' | 'lender'
    body: text("body").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("credit_deal_messages_thread_idx").on(t.raiseId, t.lenderId, t.createdAt),
    check("credit_deal_messages_side", sql`${t.authorSide} in ('platform', 'lender')`),
  ],
);

// ---------- Activity log & access requests ----------

export const activityLog = pgTable(
  "credit_activity_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    actorRole: text("actor_role").notNull(),
    lenderId: uuid("lender_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details"),
    ip: text("ip"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("credit_activity_entity_idx").on(t.entityType, t.entityId), index("credit_activity_created_idx").on(t.createdAt)],
);

export const accessRequests = pgTable("credit_access_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  side: accessSide("side").notNull(),
  name: text("name").notNull(),
  organisation: text("organisation").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message"),
  status: accessRequestStatus("status").notNull().default("new"),
  /** Version of the privacy notice the person consented to, and when (DPDP Act consent record). */
  consentNoticeVersion: text("consent_notice_version"),
  consentedAt: ts("consented_at"),
  ip: text("ip"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---------- Prospects (outreach to NBFCs not yet on the platform; platform team only) ----------

export const prospectStatus = pgEnum("credit_prospect_status", [
  "new",
  "contacted",
  "replied",
  "interested",
  "onboarded",
  "not_a_fit",
  "do_not_contact",
]);

/**
 * NBFCs from RBI's public register of registered NBFCs, plus contacts and outreach status the team adds.
 * Registry columns are refreshed by re-importing the list; team columns (status, contact, notes) are never
 * overwritten by an import.
 */
export const prospects = pgTable(
  "credit_prospects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** Key for re-imports: CIN when the register has one, otherwise the RBI registration number. */
    registryKey: text("registry_key").notNull().unique(),
    cin: text("cin"),
    rbiRegNo: text("rbi_reg_no"),
    regionalOffice: text("regional_office"),
    address: text("address"),
    registeredEmail: text("registered_email"),
    classification: text("classification"),
    layer: text("layer"),
    /** State, read from the CIN's state code (e.g. MH -> Maharashtra). */
    state: text("state"),
    lastSeenInImportAt: ts("last_seen_in_import_at"),
    /** Size, in ₹ crore, entered by the team from rating notes, filings or the NBFC itself. */
    loanBookCr: numeric("loan_book_cr", { precision: 12, scale: 2 }),
    aumCr: numeric("aum_cr", { precision: 12, scale: 2 }),
    sizeAsOf: date("size_as_of"),
    sizeSource: text("size_source"),
    // Research the team (or a rating report / company filing) adds. Each value is as stated by its source.
    segment: text("segment"),
    website: text("website"),
    ratingAgency: text("rating_agency"),
    rating: text("rating"),
    /** Long-term grade parsed from the rating (AAA, AA, A, BBB, BB, B, C, D), used for the priority score. */
    ratingGrade: text("rating_grade"),
    ratingOutlook: text("rating_outlook"),
    ratingDate: date("rating_date"),
    ratingUrl: text("rating_url"),
    gnpaPct: numeric("gnpa_pct", { precision: 6, scale: 2 }),
    crarPct: numeric("crar_pct", { precision: 6, scale: 2 }),
    bankFacilitiesCr: numeric("bank_facilities_cr", { precision: 12, scale: 2 }),
    /** Current lenders, from a rating report's annexure or the registered charges. */
    lenders: text("lenders").array(),
    /** Total of open charges registered with the Registrar of Companies, ₹ crore. */
    chargesTotalCr: numeric("charges_total_cr", { precision: 12, scale: 2 }),
    directors: text("directors"),
    lastFilingOn: date("last_filing_on"),
    researchNotes: text("research_notes"),
    researchedAt: timestamp("researched_at", { withTimezone: true }),
    status: prospectStatus("status").notNull().default("new"),
    contactName: text("contact_name"),
    contactRole: text("contact_role"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    notes: text("notes"),
    nextFollowUp: date("next_follow_up"),
    lastContactedAt: ts("last_contacted_at"),
    borrowerId: uuid("borrower_id").references(() => borrowers.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("credit_prospects_status_idx").on(t.status),
    index("credit_prospects_layer_idx").on(t.layer, t.classification),
    index("credit_prospects_name_idx").on(t.name),
    index("credit_prospects_state_idx").on(t.state),
    index("credit_prospects_aum_idx").on(t.aumCr),
    index("credit_prospects_rating_idx").on(t.ratingGrade),
    check("credit_prospects_size_positive", sql`(${t.loanBookCr} is null or ${t.loanBookCr} >= 0) and (${t.aumCr} is null or ${t.aumCr} >= 0)`),
  ],
);

/** Platform-wide prospect settings (single row, id = 1): the target book-size band, in ₹ crore. */
export const prospectSettings = pgTable(
  "credit_prospect_settings",
  {
    id: integer("id").primaryKey().default(1),
    bandMinCr: numeric("band_min_cr", { precision: 12, scale: 2 }).notNull().default("50"),
    bandMaxCr: numeric("band_max_cr", { precision: 12, scale: 2 }).notNull().default("250"),
  /** Smallest direct deal (lending to a non-NBFC company) the desk takes on, in ₹ crore. Smaller ones are flagged. */
  directMinCr: numeric("direct_min_cr", { precision: 12, scale: 2 }).notNull().default("25"),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [check("credit_prospect_settings_single", sql`${t.id} = 1`), check("credit_prospect_settings_band", sql`${t.bandMinCr} <= ${t.bandMaxCr}`)],
);

/** The outreach email the team sends from the panel. One active template; edits keep the same row. */
export const outreachTemplates = pgTable("credit_outreach_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const outreachEmails = pgTable(
  "credit_outreach_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    bodyText: text("body_text").notNull(),
    fromName: text("from_name").notNull(),
    replyTo: text("reply_to").notNull(),
    /** queued: waiting for its send time (outside 09:00–20:00 IST, sends go out at 09:00). */
    status: text("status").notNull().default("queued"),
    scheduledFor: ts("scheduled_for").notNull(),
    sentAt: ts("sent_at"),
    error: text("error"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("credit_outreach_emails_prospect_idx").on(t.prospectId, t.createdAt),
    index("credit_outreach_emails_queue_idx").on(t.status, t.scheduledFor),
    check("credit_outreach_emails_status", sql`${t.status} in ('queued', 'sending', 'sent', 'failed', 'cancelled')`),
  ],
);

// ---------- Partners and borrower submissions ----------

/** Aggregators who introduce borrower NBFCs (e.g. a regional arranger with a network of small NBFCs). */
export const partners = pgTable("credit_partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  city: text("city"),
  notes: text("notes"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const intakeStatus = pgEnum("credit_intake_status", ["draft", "submitted", "needs_info", "in_review", "accepted", "declined"]);

/**
 * One borrower NBFC's information, filled by a partner using the form in src/intake/definition.ts.
 * Partners can edit while it's a draft or when the team asks for more information; otherwise it's read-only.
 */
export const intakeSubmissions = pgTable(
  "credit_intake_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The partner firm that filled it; null for forms filled from the public website. */
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "restrict" }),
    /** partner: filled by a signed-in partner. public: filled from the website without an account. */
    source: text("source").notNull().default("partner"),
    /** Public forms: who filled it ("company" or "agent") and how to reach them. */
    submitterRole: text("submitter_role"),
    submitterName: text("submitter_name"),
    submitterEmail: text("submitter_email"),
    submitterPhone: text("submitter_phone"),
    agentFirm: text("agent_firm"),
    /** Public forms: hash of the private link's token. Whoever holds the link can continue the form. */
    accessTokenHash: text("access_token_hash").unique(),
    /** The same token, encrypted, so the team's "more information needed" email can include the link again. */
    accessTokenEnc: text("access_token_enc"),
    ip: text("ip"),
    consentNoticeVersion: text("consent_notice_version"),
    consentedAt: ts("consented_at"),
    companyName: text("company_name").notNull(),
    cin: text("cin"),
    answers: jsonb("answers").notNull().default({}),
    formVersion: integer("form_version").notNull().default(1),
    status: intakeStatus("status").notNull().default("draft"),
    /** Message from the platform team to the partner (e.g. what's needed when asking for more information). */
    teamNote: text("team_note"),
    submittedAt: ts("submitted_at"),
    borrowerId: uuid("borrower_id").references(() => borrowers.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("credit_intake_submissions_partner_idx").on(t.partnerId, t.updatedAt),
    index("credit_intake_submissions_status_idx").on(t.status),
    index("credit_intake_submissions_ip_idx").on(t.ip, t.createdAt),
    check(
      "intake_submissions_source",
      sql`(${t.source} = 'partner' and ${t.partnerId} is not null) or (${t.source} = 'public' and ${t.partnerId} is null and ${t.accessTokenHash} is not null and ${t.submitterRole} in ('company', 'agent'))`,
    ),
  ],
);

/**
 * Files attached to a submission, against the question they answer. Large files are stored as several parts
 * (each upload request stays under the host's request-size limit) and joined when downloaded.
 */
export const intakeFiles = pgTable(
  "credit_intake_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id").notNull().references(() => intakeSubmissions.id, { onDelete: "cascade" }),
    questionKey: text("question_key").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256"),
    /** Storage keys of the parts, in order. */
    parts: text("parts").array().notNull(),
    partCount: integer("part_count").notNull(),
    /** Set when every part has arrived and the content check passed. Incomplete uploads are never listed. */
    completedAt: ts("completed_at"),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("credit_intake_files_submission_idx").on(t.submissionId),
    check("credit_intake_files_size", sql`${t.sizeBytes} > 0`),
    check("credit_intake_files_parts", sql`${t.partCount} between 1 and 20`),
  ],
);

// ---------- Direct deals (lending to companies that aren't NBFCs; platform team only) ----------

export const directDealStage = pgEnum("credit_direct_deal_stage", [
  "lead",
  "diligence",
  "with_lenders",
  "term_sheet",
  "sanctioned",
  "disbursed",
  "on_hold",
  "closed_lost",
]);

/**
 * A large lending requirement from an end client (a company, not an NBFC) that the desk arranges directly with
 * lenders. Desk-only: never shown to lenders or partners. Amounts in ₹ crore, as the desk talks about them.
 */
export const directDeals = pgTable(
  "credit_direct_deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: text("company_name").notNull(),
    cin: text("cin"),
    sector: text("sector"),
    city: text("city"),
    state: text("state"),
    amountCr: numeric("amount_cr", { precision: 12, scale: 2 }).notNull(),
    facility: text("facility"),
    purpose: text("purpose"),
    tenorMonths: integer("tenor_months"),
    security: text("security"),
    rateExpectation: text("rate_expectation"),
    stage: directDealStage("stage").notNull().default("lead"),
    source: text("source"),
    contactName: text("contact_name"),
    contactRole: text("contact_role"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    nextStep: text("next_step"),
    nextStepOn: date("next_step_on"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("credit_direct_deals_stage_idx").on(t.stage, t.updatedAt),
    check("credit_direct_deals_amount_positive", sql`${t.amountCr} > 0`),
    check("credit_direct_deals_tenor", sql`${t.tenorMonths} is null or ${t.tenorMonths} between 1 and 600`),
  ],
);

export const directDealLenderStatus = pgEnum("credit_direct_deal_lender_status", [
  "to_approach",
  "approached",
  "interested",
  "term_sheet",
  "sanctioned",
  "declined",
]);

/** Each lender the desk takes a direct deal to: a lender on the platform, or one named by hand. */
export const directDealLenders = pgTable(
  "credit_direct_deal_lenders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id").notNull().references(() => directDeals.id, { onDelete: "cascade" }),
    lenderId: uuid("lender_id").references(() => lenders.id, { onDelete: "restrict" }),
    lenderName: text("lender_name"),
    status: directDealLenderStatus("status").notNull().default("to_approach"),
    amountCr: numeric("amount_cr", { precision: 12, scale: 2 }),
    rate: text("rate"),
    note: text("note"),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("credit_direct_deal_lenders_deal_idx").on(t.dealId),
    check("credit_direct_deal_lenders_who", sql`${t.lenderId} is not null or ${t.lenderName} is not null`),
  ],
);

/** Files on a direct deal (deck, financials, sanction letters), stored in parts like intake files. */
export const directDealFiles = pgTable(
  "credit_direct_deal_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id").notNull().references(() => directDeals.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256"),
    parts: text("parts").array().notNull(),
    partCount: integer("part_count").notNull(),
    completedAt: ts("completed_at"),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("credit_direct_deal_files_deal_idx").on(t.dealId), check("credit_direct_deal_files_parts", sql`${t.partCount} between 1 and 20`)],
);

/**
 * File contents (diligence documents, intake uploads, direct-deal files). Stored base64 in Postgres, like the rest of
 * Before the Bell's files. Read and written only by lib/credit/server/storage.ts, on the app's own connection after the
 * caller's permission check; RLS is on with no policies, so the restricted credit_app role can never read it directly.
 */
export const blobs = pgTable("credit_blobs", {
  key: text("key").primaryKey(),
  data: text("data").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
