import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ipoBids, offices, users } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { readBody, str } from "@/lib/http";
import { getDeal } from "@/lib/deals";
import { partnerBook } from "@/lib/partner";
import { notifyOffices } from "@/lib/notify";
import { allowIp, TOO_MANY } from "@/lib/rate";
import { AWAITING, IPO_CATEGORY, amountRange, categoriesFor, fmtAmount, ipoStage, lakhToCr, type IpoCategory } from "@/lib/ipo";

const to = (req: NextRequest, q: string) => NextResponse.redirect(new URL(`/dashboard/partner?${q}#ipo`, req.url), 303);
const err = (req: NextRequest, m: string) => to(req, "error=" + encodeURIComponent(m));

/** A person at a partner firm enters IPO interest for one of their own clients. Nothing is registered: the client is
 *  sent a personal link and the interest counts only once the client confirms it. */
export async function POST(req: NextRequest) {
  const u = await getUser();
  const book = u ? await partnerBook(u) : null;
  if (!u?.office || !book) return NextResponse.redirect(new URL("/login?next=/dashboard/partner", req.url), 303);
  if (u.office.approval !== "approved") return err(req, "Your firm is not approved yet.");
  if (!(await allowIp("partner-ipo", 40, 3600))) return err(req, TOO_MANY);
  const { data } = await readBody(req);
  const client = book.clients.find((c) => c.id === Number(data.clientId)); // only clients this person may see
  if (!client) return err(req, "Choose one of your clients.");
  if (client.approval !== "approved") return err(req, `${client.name} is not approved by the desk yet.`);
  const d = await getDeal(str(data.slug, 120));
  if (!d || !(d.published || d.ipoOnly) || ipoStage(d.ipo) !== "open") return err(req, "That issue is not open for interest.");
  const db = await getDb();
  const [co] = await db.select({ investorType: offices.investorType, category: offices.category }).from(offices).where(eq(offices.id, client.id));
  const category = str(data.category, 20) as IpoCategory;
  if (!co || !categoriesFor(co).includes(category)) return err(req, `${client.name} cannot apply in that category.`);
  const lakh = Number(String(data.amountLakh ?? "").replace(/,/g, ""));
  const [min, max] = amountRange(category);
  if (!isFinite(lakh) || lakh < min || lakh > max) return err(req, `Enter an amount between ₹${min} lakh and ₹${max.toLocaleString("en-IN")} lakh for this category.`);
  const [prev] = await db.select().from(ipoBids).where(and(eq(ipoBids.dealId, d.id), eq(ipoBids.officeId, client.id)));
  if (prev && prev.status !== "Withdrawn" && prev.status !== AWAITING) return err(req, `${client.name} has already registered interest in this issue.`);
  const people = await db.select({ id: users.id, rights: users.rights, disabled: users.disabled }).from(users).where(eq(users.officeId, client.id));
  const principal = people.find((p) => !p.disabled && /commit/i.test(p.rights)) ?? people.find((p) => !p.disabled);
  if (!principal) return err(req, `${client.name} has nobody who can confirm it. Ask the desk.`);
  const token = randomBytes(24).toString("base64url"), amountCr = String(lakhToCr(lakh)), broker = str(data.broker, 120) || null;
  const vals = { category, amountCr, broker, status: AWAITING, userId: principal.id, proposedByUserId: u.id, proposedByOfficeId: u.office.id, confirmToken: token, confirmedAt: null, updatedAt: new Date() };
  if (prev) await db.update(ipoBids).set(vals).where(eq(ipoBids.id, prev.id));
  else await db.insert(ipoBids).values({ dealId: d.id, officeId: client.id, ...vals });
  await notifyOffices([client.id], { title: `${d.company} IPO: please confirm the interest ${u.office.name} entered for you`,
    body: `${u.name} of ${u.office.name} entered ${fmtAmount(amountCr)} as ${IPO_CATEGORY[category].label.toLowerCase()}. Nothing is registered until you confirm it. You can also decline.`, link: `/ipo/confirm/${token}` });
  await log(u, `Entered IPO interest of ${fmtAmount(amountCr)} for client ${client.name}, awaiting its confirmation: ${d.company}`, d.id);
  return to(req, "msg=" + encodeURIComponent(`Sent to ${client.name} to confirm. It counts once they do.`));
}
