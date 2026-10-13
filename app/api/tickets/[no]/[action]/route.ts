import { type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tickets } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { readBody, str, done, fail } from "@/lib/http";
import { allow, TOO_MANY } from "@/lib/rate";
import { addMessage, idFromNo, tellDesk, ticketNo } from "@/lib/tickets";

/** The office side of a ticket: reply, mark resolved, or rate the desk's help. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ no: string; action: string }> }) {
  const { no, action } = await params;
  const { data, json } = await readBody(req);
  const back = `/support/${no}`;
  const user = await getUser();
  if (!user) return fail(req, json, "Please sign in again.", `/login?next=${encodeURIComponent(back)}`, 401);
  const db = await getDb();
  const [t] = await db.select().from(tickets).where(eq(tickets.id, idFromNo(no) || -1));
  if (!t || (user.role !== "admin" && (!user.officeId || t.officeId !== user.officeId))) return fail(req, json, "That ticket was not found.", "/dashboard#Support", 404);
  if (!(await allow(`ticketact:${user.id}`, 40, 3600))) return fail(req, json, TOO_MANY, back, 429);
  const now = new Date();
  if (action === "reply") {
    if (t.status === "closed") return fail(req, json, "This ticket is closed. Please raise a new one.", back);
    const body = str(data.body, 5000);
    if (body.length < 2) return fail(req, json, "Write a reply first.", back);
    await addMessage(t.id, "office", user.name, user.id, body);
    await db.update(tickets).set({ status: "open", resolvedAt: null, updatedAt: now }).where(eq(tickets.id, t.id));
    await tellDesk(t, `${t.status === "resolved" ? "Reopened" : "Reply on"} ${ticketNo(t.id)}: ${t.subject}`, `${user.name}: ${body}`);
    return done(req, json, back);
  }
  if (action === "resolve") {
    if (t.status === "closed" || t.status === "resolved") return done(req, json, back);
    await addMessage(t.id, "system", null, user.id, `${user.name} marked the ticket resolved.`);
    await db.update(tickets).set({ status: "resolved", resolvedAt: now, updatedAt: now }).where(eq(tickets.id, t.id));
    return done(req, json, back);
  }
  if (action === "rate") {
    const rating = Math.round(Number(data.rating));
    if (!(rating >= 1 && rating <= 5)) return fail(req, json, "Choose from one to five.", back);
    if (t.status !== "resolved" && t.status !== "closed") return fail(req, json, "You can rate a ticket once it is resolved.", back);
    await db.update(tickets).set({ rating, ratingNote: str(data.note, 500) || null, updatedAt: now }).where(eq(tickets.id, t.id));
    if (rating <= 3) await tellDesk(t, `${ticketNo(t.id)} rated ${rating}/5`, str(data.note, 500) || t.subject);
    return done(req, json, back);
  }
  return fail(req, json, "Unknown action.", back, 404);
}
