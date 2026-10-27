"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireDesk, log } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { tickets } from "@/db/schema";
import { done, fail } from "@/lib/form";
import { addMessage, idFromNo, tellOffice, ticketNo } from "@/lib/tickets";

const s = (f: FormData, k: string, max = 5000) => String(f.get(k) ?? "").trim().slice(0, max);

/** The desk replies (or leaves an internal note) and sets where the ticket stands. */
export async function deskReply(f: FormData) {
  const admin = await requireDesk();
  const no = s(f, "no", 20), body = s(f, "body"), internal = f.get("internal") === "on", next = s(f, "status", 20);
  const db = await getDb();
  const [t] = await db.select().from(tickets).where(eq(tickets.id, idFromNo(no) || -1));
  if (!t) redirect("/admin/tickets");
  const back = `/admin/tickets/${no}`;
  if (body.length < 2 && !next) fail(back, "Write a reply first.");
  const now = new Date();
  if (body.length >= 2) await addMessage(t.id, "desk", admin.name, admin.id, body, internal);
  const status = internal ? (next || t.status) : (next || "answered");
  const set: Partial<typeof tickets.$inferInsert> = { status, updatedAt: now };
  if (!internal && body.length >= 2 && !t.firstReplyAt) set.firstReplyAt = now;
  if (status === "resolved" && t.status !== "resolved") set.resolvedAt = now;
  if (status === "open" || status === "answered") set.resolvedAt = null;
  await db.update(tickets).set(set).where(eq(tickets.id, t.id));
  if (status !== t.status && (status === "resolved" || status === "closed")) await addMessage(t.id, "system", null, admin.id, `The desk marked the ticket ${status}.`);
  if (!internal && body.length >= 2) await tellOffice(t, `Reply from the desk on ${ticketNo(t.id)}: ${t.subject}`, body);
  else if (status !== t.status && (status === "resolved" || status === "closed")) await tellOffice(t, `${ticketNo(t.id)} ${status}: ${t.subject}`, `The desk marked your ticket ${status}. Reply on the ticket if you still need help.`);
  await log(admin, `${internal ? "Noted on" : "Replied to"} ticket ${ticketNo(t.id)}${status !== t.status ? ` (${status})` : ""}`);
  revalidatePath("/admin", "layout");
  done(back, internal ? "Note saved." : body.length >= 2 ? "Reply sent." : "Status updated.");
}
