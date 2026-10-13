import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { offices } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { readBody, str } from "@/lib/http";
import { AUM, CATEGORY, HORIZON, RESIDENCY, SECTORS, STRUCTURES, TICKET } from "@/lib/profile";

const back = (req: NextRequest, msg: string, hash = "") => NextResponse.redirect(new URL("/dashboard?msg=" + encodeURIComponent(msg) + hash, req.url), 303);

/** The office's investment profile. From the welcome pop-up only blanks are filled; from the Profile panel
 *  people with commit rights update all of it. */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user?.officeId || !user.office) return NextResponse.redirect(new URL("/login?next=/dashboard", req.url), 303);
  const { data } = await readBody(req);
  const pick = (v: unknown, ok: string[]) => { const x = str(v, 80); return ok.includes(x) ? x : null; };
  const list = (v: unknown, ok: string[]) => (Array.isArray(v) ? v : v == null ? [] : [v]).map((x) => str(x, 80)).filter((x) => ok.includes(x));
  const o = user.office;
  const db = await getDb();

  if (data.mode !== "full") {
    const set = {
      ...(!o.category && pick(data.category, CATEGORY) ? { category: pick(data.category, CATEGORY) } : {}),
      ...(!o.residency && pick(data.residency, RESIDENCY) ? { residency: pick(data.residency, RESIDENCY) } : {}),
      ...(!o.ticket && pick(data.ticket, TICKET) ? { ticket: pick(data.ticket, TICKET) } : {}),
    };
    if (Object.keys(set).length) { await db.update(offices).set(set).where(eq(offices.id, user.officeId)); await log(user, "Completed the office details"); }
    return back(req, "Thank you. Add your investment thesis in Profile so the desk can bring you the right deals.", "#Profile");
  }

  if (!/commit/i.test(user.rights)) return back(req, "Only people with commit rights can change the office's profile.", "#Profile");
  const web = str(data.website, 200);
  await db.update(offices).set({
    category: pick(data.category, CATEGORY) ?? o.category, residency: pick(data.residency, RESIDENCY) ?? o.residency, ticket: pick(data.ticket, TICKET) ?? o.ticket,
    aum: pick(data.aum, AUM), city: str(data.city, 80) || null, website: web && /^[\w.-]+\.[a-z]{2,}/i.test(web.replace(/^https?:\/\//, "")) ? web : null,
    sectors: list(data.sectors, SECTORS.map(([n]) => n)), structures: list(data.structures, STRUCTURES), horizon: pick(data.horizon, HORIZON),
    thesis: str(data.thesis, 1500) || null, coLead: data.coLead === "on" || data.coLead === true, profileAt: new Date(),
  }).where(eq(offices.id, user.officeId));
  await log(user, "Updated the office's investment profile");
  return back(req, "Profile saved. The shelf now marks the deals that fit your thesis.", "#Profile");
}
