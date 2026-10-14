import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { deskInvites, users } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { readBody, str } from "@/lib/http";
import { notifyDesk } from "@/lib/notify";
import { getSettings } from "@/lib/settings";

const back = (req: NextRequest, q: string) => NextResponse.redirect(new URL(`/dashboard?${q}#Team`, req.url), 303);
const err = (req: NextRequest, m: string) => back(req, "error=" + encodeURIComponent(m));

/** An approved office refers a peer family office. With referrals switched on, the peer is approved when it registers. */
export async function POST(req: NextRequest) {
  const u = await getUser();
  if (!u?.office) return NextResponse.redirect(new URL("/login?next=/dashboard", req.url), 303);
  if (u.office.approval !== "approved") return err(req, "Referrals open once your own office is approved.");
  const { data } = await readBody(req);
  const name = str(data.name, 120), email = str(data.email, 200).toLowerCase(), officeName = str(data.officeName, 160);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(req, "Give the person's name and email.");
  const db = await getDb();
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (taken) return err(req, `${email} is already on Before the Bell.`);
  const recent = await db.select({ id: deskInvites.id }).from(deskInvites).where(and(eq(deskInvites.referrerOfficeId, u.office.id), gt(deskInvites.createdAt, new Date(Date.now() - 30 * 864e5))));
  if (recent.length >= 5) return err(req, "Your office can refer five offices every 30 days. The desk can invite more for you.");
  const token = randomBytes(18).toString("base64url");
  await db.insert(deskInvites).values({ token, email, name, officeName: officeName || null, createdBy: `Referral by ${u.office.name}`, referrerOfficeId: u.office.id });
  const st = await getSettings();
  await notifyDesk({ title: `${u.office.name} referred ${officeName || name}`, body: st.referrals ? "Approved automatically when they register (Settings: referrals)." : "They will wait for your approval when they register.", link: "/admin/invites" });
  await log(u, `Referred ${officeName || name} to the desk`);
  return back(req, "msg=" + encodeURIComponent("Referral link ready below. Send it on WhatsApp or email."));
}
