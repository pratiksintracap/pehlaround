import { type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ndas, offices } from "@/db/schema";
import { getUser, log, clientIp, PAN_RE } from "@/lib/auth";
import { getDeal, signedDealIds } from "@/lib/deals";
import { readBody, str, done, fail } from "@/lib/http";

export async function POST(req: NextRequest) {
  const { data, json } = await readBody(req);
  const slug = str(data.slug, 120);
  const back = `/nda/${slug}`;
  const user = await getUser();
  if (!user) return fail(req, json, "Please sign in first.", `/login?next=${encodeURIComponent(back)}`, 401);
  if (!user.office) return fail(req, json, "Your account is not linked to a family office.", back, 403);
  if (user.office.status === "rejected") return fail(req, json, "Your office's access is on hold. Please contact the desk.", back, 403);
  const d = await getDeal(slug);
  if (!d || !d.published || !d.open) return fail(req, json, "This room is not open.", "/deals", 404);
  if ((await signedDealIds(user.office.id)).has(d.id)) return done(req, json, `/room/${slug}`);

  const sig = str(data.sig, 120);
  if (!sig) return fail(req, json, "Please type your full name to sign.", back);
  if (!(data.agree === true || data.agree === "on")) return fail(req, json, "Please tick the box to sign the agreement.", back);
  const db = await getDb();
  if (!user.office.pan) {
    const pan = str(data.pan, 10).toUpperCase(), entity = str(data.entity, 160);
    if (!PAN_RE.test(pan)) return fail(req, json, "Please enter a valid PAN (five letters, four digits, one letter).", back);
    if (!entity) return fail(req, json, "Please enter the investing entity's name as on PAN.", back);
    await db.update(offices).set({ pan, entityName: entity, panName: sig, status: user.office.status === "verified" ? "verified" : "pan_submitted" }).where(eq(offices.id, user.office.id));
    await log(user, "Submitted PAN for verification");
  }
  await db.insert(ndas).values({ officeId: user.office.id, dealId: d.id, userId: user.id, signerName: sig, version: d.ndaVersion,
    ip: await clientIp(), userAgent: str(req.headers.get("user-agent"), 300) }).onConflictDoNothing();
  await log(user, `Signed the NDA with ${d.company} (version ${d.ndaVersion})`, d.id);
  return done(req, json, `/room/${slug}`);
}
