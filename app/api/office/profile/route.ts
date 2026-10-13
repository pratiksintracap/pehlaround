import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { offices } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { readBody, str } from "@/lib/http";

const CATEGORY = ["Individual", "HUF", "Private company", "LLP", "Trust", "Family-office AIF", "Other"];
const RESIDENCY = ["Resident in India", "Non-resident (FEMA route applies)"];
const TICKET = ["₹50 lakh – 1 crore", "₹1–2 crore", "₹2–5 crore", "₹5–25 crore", "Above ₹25 crore"];

/** The office completes the details the desk needs (from the welcome pop-up). Only blanks are filled. */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user?.officeId || !user.office) return NextResponse.redirect(new URL("/login?next=/dashboard", req.url), 303);
  const { data } = await readBody(req);
  const pick = (v: unknown, ok: string[]) => { const x = str(v, 80); return ok.includes(x) ? x : null; };
  const o = user.office;
  const set = {
    ...(!o.category && pick(data.category, CATEGORY) ? { category: pick(data.category, CATEGORY) } : {}),
    ...(!o.residency && pick(data.residency, RESIDENCY) ? { residency: pick(data.residency, RESIDENCY) } : {}),
    ...(!o.ticket && pick(data.ticket, TICKET) ? { ticket: pick(data.ticket, TICKET) } : {}),
  };
  if (Object.keys(set).length) {
    const db = await getDb();
    await db.update(offices).set(set).where(eq(offices.id, user.officeId));
    await log(user, "Completed the office profile");
  }
  return NextResponse.redirect(new URL("/dashboard?msg=" + encodeURIComponent("Thank you. Your office profile is complete."), req.url), 303);
}
