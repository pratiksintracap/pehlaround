import { type NextRequest } from "next/server";
import { track } from "@/lib/track";
import { getDb } from "@/lib/db";
import { ndas, users, offices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUser, log, clientIp } from "@/lib/auth";
import { emailReady } from "@/lib/email";
import { trustDevice, trustedDevice } from "@/lib/trust";
import { checkCode } from "@/lib/sign-code";
import { getDeal, signedDealIds, canSeeNames } from "@/lib/deals";
import { notifyDesk } from "@/lib/notify";
import { emailSignedNda } from "@/lib/nda-mail";
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
  if (!(await canSeeNames(user))) return fail(req, json, "Your office is still being approved by the desk.", back, 403);

  const sig = str(data.sig, 120);
  if (!sig) return fail(req, json, "Please type your full name to sign.", back);
  if (!(data.agree === true || data.agree === "on")) return fail(req, json, "Please tick the box to sign the agreement.", back);
  // Profile details skipped on the short invitation form are given once, here, before the first NDA.
  const prof = { phone: str(data.phone, 40), role: str(data.role, 80), category: str(data.category, 60), residency: str(data.residency, 80), ticket: str(data.ticket, 60) };
  const missing = (!user.phone && !prof.phone) || (!user.officeRole && !prof.role) || (!user.office.category && !prof.category)
    || (!user.office.residency && !prof.residency) || (!user.office.ticket && !prof.ticket);
  if (missing) return fail(req, json, "Please fill in the few details above the NDA; they are asked only once.", back);
  // Signing is confirmed with a one-time code emailed to the signer (whenever email is set up).
  let verified = false, trusted = false;
  if (emailReady() && (await trustedDevice(user.id))) { verified = true; trusted = true; }
  else if (emailReady()) {
    const code = str(data.code, 12);
    if (!code) return fail(req, json, "Enter the six-digit code we emailed you, or send a new one.", back);
    const r = await checkCode(user.id, d.id, code);
    if (r === "none") return fail(req, json, "That code has expired. Send a new one and enter it within 10 minutes.", back);
    if (r === "expired") return fail(req, json, "Too many wrong tries. Send a new code.", back);
    if (r === "wrong") return fail(req, json, "That code is not right. Check the latest email from Before the Bell.", back);
    verified = true;
    await trustDevice(user.id);
  }
  const db = await getDb();
  if (!user.phone || !user.officeRole) await db.update(users).set({ ...(!user.phone ? { phone: prof.phone } : {}), ...(!user.officeRole ? { officeRole: prof.role } : {}) }).where(eq(users.id, user.id));
  if (!user.office.category || !user.office.residency || !user.office.ticket) await db.update(offices).set({
    ...(!user.office.category ? { category: prof.category } : {}), ...(!user.office.residency ? { residency: prof.residency } : {}), ...(!user.office.ticket ? { ticket: prof.ticket } : {}),
  }).where(eq(offices.id, user.office.id));
  const [signed] = await db.insert(ndas).values({ officeId: user.office.id, dealId: d.id, userId: user.id, signerName: sig, signerEmail: user.email, codeVerified: verified,
    version: d.ndaVersion, ip: await clientIp(), userAgent: str(req.headers.get("user-agent"), 300) }).onConflictDoNothing().returning({ id: ndas.id });
  if (signed) await emailSignedNda(signed.id).catch(() => 0);
  await log(user, `Signed the NDA with ${d.company} (version ${d.ndaVersion})`, d.id);
  if (signed) await track("nda_signed", { officeId: user.office.id, userId: user.id, dealId: d.id });
  if (user.intent === d.slug) await db.update(users).set({ intent: null }).where(eq(users.id, user.id));
  await notifyDesk({ title: `${user.office.name} signed the NDA with ${d.company}`, body: `Signed by ${sig}${trusted ? ", on a device confirmed by email code in the last 30 days" : verified ? ", email code confirmed" : ""}.`, link: "/admin/offices" });
  return done(req, json, `/room/${slug}`);
}
