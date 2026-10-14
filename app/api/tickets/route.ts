import { type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { tickets } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { getDeal } from "@/lib/deals";
import { readBody, str, done, fail } from "@/lib/http";
import { allow, TOO_MANY } from "@/lib/rate";
import { CATEGORIES, addMessage, catLabel, tellDesk, ticketNo } from "@/lib/tickets";
import { isDesk } from "@/lib/perm";

/** An office raises a support ticket. */
export async function POST(req: NextRequest) {
  const { data, json } = await readBody(req);
  const back = "/dashboard#Support";
  const user = await getUser();
  if (!user) return fail(req, json, "Please sign in again.", "/login?next=/dashboard%23Support", 401);
  if (!user.office && !isDesk(user)) return fail(req, json, "Only family offices can raise tickets.", back, 403);
  if (!(await allow(`ticket:${user.id}`, 10, 3600))) return fail(req, json, TOO_MANY, back, 429);
  const category = str(data.category, 40), subject = str(data.subject, 160), body = str(data.body, 5000);
  if (!CATEGORIES.some((c) => c.id === category)) return fail(req, json, "Choose what the ticket is about.", back);
  if (subject.length < 4) return fail(req, json, "Add a short subject.", back);
  if (body.length < 10) return fail(req, json, "Describe the issue in a line or two.", back);
  const deal = str(data.deal, 120) ? await getDeal(str(data.deal, 120)) : null;
  const db = await getDb();
  const [t] = await db.insert(tickets).values({ officeId: user.officeId, userId: user.id, dealId: deal?.id ?? null, category, subject }).returning();
  await addMessage(t.id, "office", user.name, user.id, body);
  await log(user, `Raised ticket ${ticketNo(t.id)}: ${subject}`, deal?.id ?? null);
  await tellDesk(t, `New ticket ${ticketNo(t.id)} from ${user.office?.name ?? user.name}: ${subject}`, `${catLabel(category)}${deal ? ` · ${deal.company}` : ""}\n\n${body}`);
  return done(req, json, `/support/${ticketNo(t.id)}`);
}
