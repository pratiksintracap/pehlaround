import { type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { offices, users, invites, deskInvites, dealLinks, deals } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { createSession, log, pendingIdentity, OAUTH_PENDING } from "@/lib/auth";
import { emailReady } from "@/lib/email";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { readBody, str, safeNext, done, fail } from "@/lib/http";
import { notifyDesk } from "@/lib/notify";
import { allowIp, isBot, TOO_MANY } from "@/lib/rate";
import { startSeries } from "@/lib/onboarding";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const { data, json } = await readBody(req);
  const next = safeNext(data.next, "/dashboard");
  const inviteToken = str(data.invite, 100), linkToken = str(data.link, 100);
  const back = "/register?" + new URLSearchParams({ ...(data.next ? { next } : {}), ...(inviteToken ? { invite: inviteToken } : {}), ...(linkToken ? { link: linkToken } : {}) }).toString();
  const name = str(data.name, 120), entity = str(data.entity, 160), email = str(data.email, 200).toLowerCase(), phone = str(data.phone, 40);
  const password = typeof data.password === "string" ? data.password : "";
  if (isBot(data)) return done(req, json, "/");
  if (!(await allowIp("register", 10, 3600))) return fail(req, json, TOO_MANY, back, 429);
  if (!name || !email || !phone) return fail(req, json, "Please fill in your name, email and mobile.", back);
  if (!EMAIL.test(email)) return fail(req, json, "Please enter a valid email address.", back);
  // A password is optional when Google or Microsoft confirmed this email, or when sign-in codes can be emailed.
  const pend = await pendingIdentity();
  const viaProvider = !!pend && pend.email === email;
  if (password ? password.length < 8 : !viaProvider && !emailReady()) return fail(req, json, "Choose a password of at least 8 characters.", back);
  if (!(data.privacy === true || data.privacy === "on" || data.privacy === "yes")) return fail(req, json, "Please accept the privacy notice.", back);
  if (!(data.risk === true || data.risk === "on" || data.risk === "yes")) return fail(req, json, "Please confirm the risk statement.", back);

  const db = await getDb();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) return fail(req, json, "This email is already registered. Please sign in.", back, 409);

  // An office can invite its CIO, CFO or CA; they join that office instead of creating a new one.
  const [inv] = await db.select().from(invites).where(and(eq(invites.email, email), isNull(invites.acceptedAt)));
  let officeId: number;
  let invited = false, how = "";
  if (inv) {
    officeId = inv.officeId;
    await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, inv.id));
  } else {
    if (!entity) return fail(req, json, "Please enter the family office or family name.", back);
    // An invitation from the desk, a personal deal link, or (when switched on) a referral by an approved office
    // registers the office already approved.
    const st = await getSettings();
    const [dinv] = inviteToken ? await db.select().from(deskInvites).where(and(eq(deskInvites.token, inviteToken), isNull(deskInvites.usedAt))) : [];
    const [lk] = linkToken ? await db.select().from(dealLinks).where(and(eq(dealLinks.token, linkToken), isNull(dealLinks.officeId), isNull(dealLinks.registeredAt))) : [];
    const referred = dinv?.referrerOfficeId ? (await db.select({ name: offices.name, approval: offices.approval }).from(offices).where(eq(offices.id, dinv.referrerOfficeId)))[0] : undefined;
    const preApproved = !!lk || (!!dinv && (!dinv.referrerOfficeId || (st.referrals && referred?.approval === "approved")));
    const [o] = await db.insert(offices).values({
      ...(preApproved ? { approval: "approved", approvedAt: new Date() } : {}),
      name: entity, category: str(data.category, 60) || null, residency: str(data.residency, 80) || null, ticket: str(data.ticket, 60) || null,
      consents: { email: true, wa: data.contact === "on" || data.contact === true || data.contact === "yes", calls: data.contact === "on" || data.contact === true || data.contact === "yes" },
    }).returning({ id: offices.id });
    officeId = o.id;
    if (dinv) await db.update(deskInvites).set({ usedAt: new Date(), officeId }).where(eq(deskInvites.id, dinv.id));
    if (lk) await db.update(dealLinks).set({ registeredAt: new Date(), registeredOfficeId: officeId }).where(eq(dealLinks.id, lk.id));
    invited = preApproved;
    how = lk ? `from the desk's link to ${(await db.select({ c: deals.company }).from(deals).where(eq(deals.id, lk.dealId)))[0]?.c ?? "a deal"}`
      : referred ? `referred by ${referred.name}` : dinv ? "through the desk's invitation" : "";
  }
  // The deal they registered from: once approved, they land on it (see the dashboard).
  const intent = /^\/deals\/([a-z0-9-]+)/.exec(next)?.[1] ?? null;
  const [u] = await db.insert(users).values({
    email, name, phone, officeId, intent, officeRole: str(data.role, 80) || null, rights: inv ? inv.rights : "View, comment, commit",
    passwordHash: await bcrypt.hash(password || randomBytes(24).toString("hex"), 10), lastLoginAt: new Date(),
  }).returning();
  // viewers named at registration become invites
  for (const v of str(data.viewers, 600).split(/[\s,;]+/).map((x) => x.toLowerCase()).filter((x) => EMAIL.test(x) && x !== email).slice(0, 10)) {
    await db.insert(invites).values({ officeId, email: v, rights: "View", invitedBy: u.id });
  }
  await createSession(u.id);
  if (pend) (await cookies()).delete(OAUTH_PENDING);
  await log({ id: u.id, name: u.name, officeId }, (inv ? "Joined the office by invitation" : "Registered the office") + (viaProvider ? ` (email confirmed by ${pend!.provider})` : password ? "" : " (signs in with email codes)") + "; accepted the site disclaimer and risk statement");
  if (!inv) await notifyDesk(invited
    ? { title: `Office registered, approved ${how}: ${entity}`, body: `${name} · ${str(data.role, 80)} · ${str(data.ticket, 60)}.`, link: "/admin/offices" }
    : { title: `New family office registered: ${entity}`, body: `${name} · ${str(data.role, 80)} · ${str(data.ticket, 60)}. Approve or hold it in the admin.`, link: "/admin/offices?show=pending" });
  // The onboarding email series: from approval if the office is already approved, otherwise from registration.
  const [off] = await db.select({ approval: offices.approval }).from(offices).where(eq(offices.id, officeId));
  await startSeries(u.id, off?.approval === "approved" ? "approved" : "register").catch(() => 0);
  return done(req, json, next);
}
