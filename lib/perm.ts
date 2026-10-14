// Desk roles and what each may do. One place for every rule; pages, actions and the admin menu all ask here.
// Stored roles: "admin" is the super admin (kept as "admin" so existing accounts need no change), "analyst" is desk staff.

export type DeskRole = "admin" | "analyst";
export const ROLE_LABEL: Record<DeskRole, string> = { admin: "Super admin", analyst: "Analyst" };
export const DESK_ROLES: DeskRole[] = ["admin", "analyst"];

type Who = { role?: string | null } | null | undefined;
export const isDesk = (u: Who) => u?.role === "admin" || u?.role === "analyst";
export const isSuper = (u: Who) => u?.role === "admin";

export type Perm =
  | "offices.approve"     // approve, hold or reject a family office
  | "offices.notes"       // desk notes on an office
  | "offices.manage"      // verification status, passwords, disable people, revoke NDAs
  | "contacts.view"       // office people's email and phone (analysts only if Settings allows)
  | "deals.edit"          // create deals, edit content, documents, Q&A, calls
  | "deals.publish"       // publish, unpublish, open or close a deal; announce it
  | "delete"              // delete documents, articles
  | "allocations.confirm" // change an allocation request's status (tells the office)
  | "leads"               // founder leads
  | "articles.edit"       // draft articles
  | "articles.publish"    // publish or edit a live article
  | "broadcast.send"      // send a notification or email to offices
  | "settings"            // site settings
  | "emails"              // onboarding email series
  | "invites"             // invite family offices
  | "team"                // desk team and roles
  | "log.all";            // everyone's actions in the audit log

const ANALYST: Perm[] = ["offices.approve", "offices.notes", "deals.edit", "leads", "articles.edit"];

/** opts.analystContacts: the super admin's Settings switch that lets analysts see office contact details. */
export function can(u: Who, p: Perm, opts?: { analystContacts?: boolean }) {
  if (isSuper(u)) return true;
  if (u?.role !== "analyst") return false;
  if (p === "contacts.view") return !!opts?.analystContacts;
  return ANALYST.includes(p);
}

/** Which admin pages each role sees (the menu and the page guards use the same list). */
export const SUPER_ONLY_PAGES = ["/admin/settings", "/admin/emails", "/admin/invites", "/admin/team"];
export const mask = (s?: string | null) => (s ? s.replace(/^(.{2}).*?(@|.{2}$)/, (_m, a, b) => `${a}•••${b === "@" ? "@" : b}`) : s);
