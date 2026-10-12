import { pgTable, serial, text, integer, boolean, timestamp, jsonb, uniqueIndex, index, numeric } from "drizzle-orm/pg-core";
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
  // registered -> pan_submitted -> verified | rejected
  status: text("status").notNull().default("registered"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  consents: jsonb("consents").$type<Record<string, boolean>>().default({}),
  sectors: jsonb("sectors").$type<string[]>().default([]),
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
  version: text("version").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("ndas_office_deal_uq").on(t.officeId, t.dealId)]);

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  title: text("title").notNull(),
  kind: text("kind"),                           // PDF · 48 pp
  status: text("status").notNull().default("available"), // available | requested | on_request
  url: text("url"),                             // link to the file (Drive, Blob ...)
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
  author: text("author").notNull().default("Pehla Round desk"),
  published: boolean("published").notNull().default(true),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("articles_slug_uq").on(t.slug)]);
