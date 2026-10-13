import { pgTable, serial, text, integer, boolean, timestamp, jsonb, uniqueIndex, index, numeric, doublePrecision } from "drizzle-orm/pg-core";
import type { RoomContent } from "@/lib/types";

// A family office (the investing entity). Several users can belong to one office.
export const offices = pgTable("offices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),                 // "Mehta Family Office"
  category: text("category"),                   // Individual, HUF, Private company, LLP, Trust, ...
  residency: text("residency"),
  ticket: text("ticket"),
  entityName: text("entity_name"),              // investing entity, as on PAN
  pan: text("pan"),                             // full PAN, visible to admins only
  panName: text("pan_name"),
  // registered -> pan_submitted -> verified | rejected  (PAN check)
  status: text("status").notNull().default("registered"),
  // pending -> approved | rejected  (the desk's approval of the office)
  approval: text("approval").notNull().default("pending"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  consents: jsonb("consents").$type<Record<string, boolean>>().default({}),
  sectors: jsonb("sectors").$type<string[]>().default([]),
  // investment profile, kept by the office
  aum: text("aum"),                             // assets under management, as a band
  city: text("city"),
  website: text("website"),
  structures: jsonb("structures").$type<string[]>().default([]),
  horizon: text("horizon"),
  thesis: text("thesis"),
  coLead: boolean("co_lead").notNull().default(false),
  profileAt: timestamp("profile_at", { withTimezone: true }),
  notes: text("notes"),                         // admin notes
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("member"),        // member | admin
  officeRole: text("office_role"),                        // Principal, CIO, CA ...
  rights: text("rights").notNull().default("View, comment, commit"),
  officeId: integer("office_id").references(() => offices.id),
  passwordHash: text("password_hash").notNull(),
  disabled: boolean("disabled").notNull().default(false),
  sessionVersion: integer("session_version").notNull().default(0), // bump to sign the user out everywhere
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
}, (t) => [uniqueIndex("users_email_uq").on(t.email)]);

// Viewers an office has invited; they join the office when they register with that email.
export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  officeId: integer("office_id").notNull().references(() => offices.id),
  email: text("email").notNull(),
  rights: text("rights").notNull().default("View"),
  invitedBy: integer("invited_by").references(() => users.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  company: text("company").notNull(),           // shown only inside the room
  title: text("title").notNull(),               // anonymised public title (sector)
  category: text("category").notNull(),         // Pre-IPO primary | Pre-IPO secondary | Growth round
  stage: text("stage").notNull(),               // tag on the card: "Room open", "Live mandate", "Not open"
  status: text("status").notNull(),             // "Room open to registered offices"
  headline: text("headline").notNull(),         // anonymised one-liner
  listingLabel: text("listing_label").notNull(),// "Sept 2028" or "To be confirmed"
  listingMonth: text("listing_month"),          // "2028-09" for the runway and sorting
  listingNote: text("listing_note"),            // "main board"
  roundLabel: text("round_label"),              // gated: "₹50 Cr"
  preMoney: text("pre_money"),                  // gated: "₹1,200 Cr"
  peLabel: text("pe_label"),                    // gated: "35x · 18x"
  minTicket: text("min_ticket"),                // gated: "₹1 Cr"
  open: boolean("open").notNull().default(true),        // room can be opened with an NDA
  published: boolean("published").notNull().default(true),
  sort: integer("sort").notNull().default(100),
  art: text("art"),                             // inline SVG for the card
  score: doublePrecision("score"),               // Desk Score out of 10, set by the desk (proprietary)
  publicRisks: jsonb("public_risks").$type<string[]>().notNull().default([]),
  asOf: text("as_of"),                          // "11 Oct 2026"
  ndaVersion: text("nda_version").notNull().default("2026-10-12"),
  room: jsonb("room").$type<RoomContent>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("deals_slug_uq").on(t.slug)]);

// One NDA per office per company.
export const ndas = pgTable("ndas", {
  id: serial("id").primaryKey(),
  officeId: integer("office_id").notNull().references(() => offices.id),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  userId: integer("user_id").notNull().references(() => users.id),
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email"),             // the address the one-time code was sent to
  codeVerified: boolean("code_verified").notNull().default(false),
  version: text("version").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("ndas_office_deal_uq").on(t.officeId, t.dealId)]);

// One-time codes for signing an NDA: emailed to the signer, valid for 10 minutes, stored only as a hash.
export const signCodes = pgTable("sign_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  dealId: integer("deal_id").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("sign_codes_user_deal_idx").on(t.userId, t.dealId)]);

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  title: text("title").notNull(),
  kind: text("kind"),                           // PDF · 48 pp
  status: text("status").notNull().default("available"), // available | requested | on_request
  url: text("url"),                             // link to the file (Drive, Blob ...)
  // who sees it: nda = every office that signed this company's NDA; allocation = only offices that requested an
  // allocation in this deal; offices = only the offices listed in officeIds
  audience: text("audience").notNull().default("nda"),
  officeIds: jsonb("office_ids").$type<number[]>().notNull().default([]),
  sort: integer("sort").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const docViews = pgTable("doc_views", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id),
  userId: integer("user_id").notNull().references(() => users.id),
  officeId: integer("office_id"),
  ip: text("ip"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  officeId: integer("office_id"),
  userId: integer("user_id"),
  question: text("question").notNull(),
  answer: text("answer"),
  answeredBy: text("answered_by"),              // "Promoter", "Desk", "Mandate holder"
  askedAt: timestamp("asked_at", { withTimezone: true }).notNull().defaultNow(),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  hidden: boolean("hidden").notNull().default(false),
  private: boolean("private").notNull().default(false),   // asked privately: only the asking office sees it and the answer
}, (t) => [index("questions_deal_idx").on(t.dealId)]);

export const calls = pgTable("calls", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  officeId: integer("office_id"),
  userId: integer("user_id"),
  kind: text("kind").notNull().default("request"),  // request | session (a group session the desk scheduled)
  title: text("title"),
  slot: text("slot"),
  attendees: text("attendees"),
  questions: text("questions"),
  status: text("status").notNull().default("Requested"), // Requested | Scheduled | Held | Declined
  scheduledFor: text("scheduled_for"),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const interests = pgTable("interests", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  officeId: integer("office_id").notNull(),
  userId: integer("user_id").notNull(),
  amountCr: numeric("amount_cr").notNull(),
  colead: boolean("colead").notNull().default(false),
  status: text("status").notNull().default("Indicated"), // Indicated | Term sheet | Documents | Allotted | Withdrawn
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passes = pgTable("passes", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  officeId: integer("office_id").notNull(),
  userId: integer("user_id").notNull(),
  reason: text("reason").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Per office, per deal: alert switches and the office's own checklist.
export const dealPrefs = pgTable("deal_prefs", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  officeId: integer("office_id").notNull(),
  alerts: jsonb("alerts").$type<string[]>().notNull().default([]),
  ticks: jsonb("ticks").$type<string[]>().notNull().default([]),
  saved: boolean("saved").notNull().default(false),
  alertsSet: boolean("alerts_set").notNull().default(false),   // false: the office never chose, so every alert is on
}, (t) => [uniqueIndex("deal_prefs_uq").on(t.officeId, t.dealId)]);

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull().default("founder"),
  name: text("name"),
  company: text("company"),
  email: text("email"),
  phone: text("phone"),
  data: jsonb("data").$type<Record<string, string>>().default({}),
  status: text("status").notNull().default("New"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const audit = pgTable("audit", {
  id: serial("id").primaryKey(),
  officeId: integer("office_id"),
  userId: integer("user_id"),
  who: text("who"),
  action: text("action").notNull(),
  dealId: integer("deal_id"),
  ip: text("ip"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_office_idx").on(t.officeId)]);

// Articles by the desk: the home-page strip and /articles. externalUrl marks a piece published elsewhere.
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  dek: text("dek"),
  body: text("body").notNull().default(""),     // paragraphs separated by blank lines; "## " headings; "- " bullets
  sources: jsonb("sources").$type<{ title: string; url: string }[]>().notNull().default([]),
  externalUrl: text("external_url"),
  image: text("image"),                         // optional cover image URL; a generated cover is used otherwise
  author: text("author").notNull().default("Off Market Desk team"),
  published: boolean("published").notNull().default(true),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("articles_slug_uq").on(t.slug)]);

// Messages to offices (and to the desk). One row per recipient office; officeId null + toAdmin = for the desk.
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  officeId: integer("office_id"),
  toAdmin: boolean("to_admin").notNull().default(false),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  broadcastId: integer("broadcast_id"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("notifications_office_idx").on(t.officeId)]);

// Messages the desk sent from the admin, with their audience.
export const broadcasts = pgTable("broadcasts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  audience: text("audience").notNull(),
  dealId: integer("deal_id"),
  recipients: integer("recipients").notNull().default(0),
  emailed: integer("emailed").notNull().default(0),
  sentBy: text("sent_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Site settings the desk changes from the admin.
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Invitations the desk sends to family offices: the link registers the office already approved.
export const deskInvites = pgTable("desk_invites", {
  id: serial("id").primaryKey(),
  token: text("token").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  officeName: text("office_name"),
  createdBy: text("created_by"),
  usedAt: timestamp("used_at", { withTimezone: true }),
  officeId: integer("office_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("desk_invites_token_uq").on(t.token)]);

// Self-serve password reset links (stored hashed, valid for a short time, used once).
export const passwordResets = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("password_resets_token_uq").on(t.tokenHash)]);

// Attempts per key (action + IP or email) for rate limiting.
export const rateHits = pgTable("rate_hits", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("rate_hits_key_at_idx").on(t.key, t.at)]);

// Public deal-overview views, for the desk's per-deal funnel (no personal data for visitors who are not signed in).
export const dealViews = pgTable("deal_views", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  officeId: integer("office_id"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("deal_views_deal_at_idx").on(t.dealId, t.at)]);

// Onboarding email series: one row per person per step, sent by the daily 9 AM IST run.
export const emailQueue = pgTable("email_queue", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  officeId: integer("office_id"),
  step: text("step").notNull(),
  sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("pending"),   // pending | sent | skipped
  reason: text("reason"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("email_queue_user_step_uq").on(t.userId, t.step), index("email_queue_due_idx").on(t.status, t.sendAt)]);

// The AI analyst: one conversation per person, in a deal room or on the dashboard. Kept on the office's record; the desk can read it.
export const aiChats = pgTable("ai_chats", {
  id: serial("id").primaryKey(),
  officeId: integer("office_id"),
  userId: integer("user_id").notNull(),
  dealId: integer("deal_id"),                   // null: asked from the dashboard, across the office's rooms
  title: text("title").notNull(),
  messages: jsonb("messages").$type<{ role: "user" | "assistant"; text: string; cites?: { url?: string; title: string; kind: "web" | "room" }[]; at: string }[]>().notNull().default([]),
  searches: integer("searches").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ai_chats_user_idx").on(t.userId, t.dealId)]);
