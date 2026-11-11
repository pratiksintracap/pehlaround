import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ipoBids } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { readBody, str } from "@/lib/http";
import { getDeal, canSeeNames } from "@/lib/deals";
import { notifyDesk } from "@/lib/notify";
import { track } from "@/lib/track";
import { allowIp, TOO_MANY } from "@/lib/rate";
import { IPO_CATEGORY, amountRange, categoriesFor, fmtAmount, ipoStage, lakhToCr, type IpoCategory } from "@/lib/ipo";

const to = (req: NextRequest, q: string) => NextResponse.redirect(new URL(`/dashboard?${q}#IPOs`, req.url), 303);
const err = (req: NextRequest, m: string) => to(req, "error=" + encodeURIComponent(m));
const ok = (req: NextRequest, m: string) => to(req, "msg=" + encodeURIComponent(m));

/** An approved office registers, changes or withdraws its interest in a company's IPO, while the issue is open for
 *  interest (prospectus filed, issue not yet closed). An indication only: the office applies through its own broker. */
export async function POST(req: NextRequest) {
  const u = await getUser();
  if (!u?.office) return NextResponse.redirect(new URL("/login?next=/dashboard", req.url), 303);
  if (!(await canSeeNames(u))) return err(req, "IPOs open to your office once the desk approves it.");
  if (!/commit/i.test(u.rights)) return err(req, "Your access is view-only. Ask your office's principal to register interest.");
  if (!(await allowIp("ipo", 30, 3600))) return err(req, TOO_MANY);
  const { data } = await readBody(req);
  const d = await getDeal(str(data.slug, 120));
  if (!d || !d.published) return err(req, "That issue is not on the desk.");
  const stage = ipoStage(d.ipo);
  const db = await getDb();
  const [prev] = await db.select().from(ipoBids).where(and(eq(ipoBids.dealId, d.id), eq(ipoBids.officeId, u.office.id)));

  if (data.action === "withdraw") {
    if (!prev || prev.status === "Withdrawn") return ok(req, "Nothing to withdraw.");
    if (prev.status === "Allotted") return err(req, "This interest is already marked allotted.");
    await db.update(ipoBids).set({ status: "Withdrawn", updatedAt: new Date() }).where(eq(ipoBids.id, prev.id));
    await log(u, `Withdrew IPO interest: ${d.company}`, d.id);
    await notifyDesk({ title: `${u.office.name} withdrew its IPO interest in ${d.company}`, link: "/admin/ipo" });
    return ok(req, `Your interest in ${d.company}'s IPO is withdrawn.`);
  }

  if (stage !== "open") return err(req, stage === "none" ? "This issue is not open for interest yet." : "This issue has closed.");
  const category = str(data.category, 20) as IpoCategory;
  if (!categoriesFor(u.office).includes(category)) return err(req, "Choose the category you will apply in.");
  const lakh = Number(String(data.amountLakh ?? "").replace(/,/g, ""));
  const [min, max] = amountRange(category);
  if (!isFinite(lakh) || lakh < min || lakh > max) return err(req, `Enter an amount between ₹${min} lakh and ₹${max.toLocaleString("en-IN")} lakh for this category.`);
  const amountCr = String(lakhToCr(lakh)), broker = str(data.broker, 120) || null;
  if (prev && !["Indicated", "Withdrawn"].includes(prev.status)) return err(req, `Your interest is already ${prev.status.toLowerCase()}; ask the desk to change it.`);
  if (prev) await db.update(ipoBids).set({ category, amountCr, broker, status: "Indicated", userId: u.id, updatedAt: new Date() }).where(eq(ipoBids.id, prev.id));
  else await db.insert(ipoBids).values({ dealId: d.id, officeId: u.office.id, userId: u.id, category, amountCr, broker });
  await log(u, `Registered IPO interest of ${fmtAmount(amountCr)} as ${IPO_CATEGORY[category].label.toLowerCase()}: ${d.company}`, d.id);
  await track("ipo_interest", { officeId: u.office.id, userId: u.id, dealId: d.id, meta: { amountCr: Number(amountCr), category } });
  await notifyDesk({ title: `IPO interest: ${fmtAmount(amountCr)} in ${d.company}`, body: `${u.office.name} · ${u.name} · ${IPO_CATEGORY[category].label}${broker ? ` · applying through ${broker}` : ""}`, link: "/admin/ipo" });
  return ok(req, `Interest registered for ${d.company}'s IPO. Remember to apply through your broker before the issue closes.`);
}
