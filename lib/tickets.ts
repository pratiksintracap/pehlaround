import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { notifications, ticketMessages, tickets, users } from "@/db/schema";
import { notifyDesk, sendEmail } from "@/lib/notify";

// Support tickets, Zerodha-style: a number, a category, a status, and one thread between the office and the desk.

export const CATEGORIES: { id: string; label: string; help: string[] }[] = [
  { id: "account", label: "Account and registration", help: ["The desk approves new offices within a working day; you are told under the bell and by email.", "Add your CIO, CFO or CA from Team; they join your office when they register with that email."] },
  { id: "nda", label: "NDA and room access", help: ["Sign a company's NDA on screen from the deal; its room opens straight away.", "No code email? Check spam, then send a new code from the NDA page."] },
  { id: "deal", label: "A deal on the desk", help: ["Questions for the promoter go best in the room's Q&A, where the answer is posted for you.", "Use a ticket for anything you want to raise with the desk privately."] },
  { id: "allocation", label: "Allocation, KYC and payment", help: ["Request an allocation from the room with the slider; the desk shares the draft term sheet next.", "KYC is needed only when your office invests, for the entity that invests."] },
  { id: "documents", label: "Documents and data room", help: ["Some documents open only after your office requests an allocation; the room marks which."] },
  { id: "technical", label: "Problem with the site or app", help: ["Tell us the page, the device and what you saw; a screenshot link helps."] },
  { id: "other", label: "Feedback or something else", help: [] },
];
export const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;
export const ticketNo = (id: number) => `BTB-${1000 + id}`;
export const idFromNo = (no: string) => { const m = /^(?:BTB|OMD)-(\d+)$/i.exec(no.trim()); return m ? Number(m[1]) - 1000 : NaN; };

export const STATUS: Record<string, { label: string; office: string; pill: string }> = {
  open: { label: "With the desk", office: "With the desk", pill: "mid" },
  answered: { label: "Awaiting office", office: "Desk replied", pill: "ok" },
  resolved: { label: "Resolved", office: "Resolved", pill: "" },
  closed: { label: "Closed", office: "Closed", pill: "off" },
};

/** Tell the office that raised it: under the bell for the whole office, and by email to the person who raised it. */
export async function tellOffice(t: typeof tickets.$inferSelect, title: string, body: string) {
  const db = await getDb();
  const link = `/support/${ticketNo(t.id)}`;
  if (t.officeId) await db.insert(notifications).values({ officeId: t.officeId, title, body: body.slice(0, 300), link });
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, t.userId));
  if (u?.email) await sendEmail([u.email], { title, body, link }).catch(() => 0);
}

export async function tellDesk(t: typeof tickets.$inferSelect, title: string, body: string) {
  await notifyDesk({ title, body: body.slice(0, 400), link: `/admin/tickets/${ticketNo(t.id)}` });
}

export async function addMessage(ticketId: number, from: "office" | "desk" | "system", who: string | null, userId: number | null, body: string, internal = false) {
  const db = await getDb();
  await db.insert(ticketMessages).values({ ticketId, from, who, userId, body, internal });
}
