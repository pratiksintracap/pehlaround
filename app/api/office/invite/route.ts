import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { invites, users } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { readBody, str } from "@/lib/http";

const back = (req: NextRequest, q: string) => NextResponse.redirect(new URL(`/dashboard?${q}#Team`, req.url), 303);

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user?.officeId) return NextResponse.redirect(new URL("/login", req.url), 303);
  if (!/commit/i.test(user.rights)) return back(req, "error=" + encodeURIComponent("Only the office's principal can add viewers."));
  const { data } = await readBody(req);
  const email = str(data.email, 200).toLowerCase();
  const rights = ["View", "View, comment", "View, comment, commit"].includes(str(data.rights)) ? str(data.rights) : "View";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return back(req, "error=" + encodeURIComponent("Please enter a valid email."));
  const db = await getDb();
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (u) return back(req, "error=" + encodeURIComponent("That email already has an account. Ask the desk to move it to your office."));
  const [dup] = await db.select({ id: invites.id }).from(invites).where(and(eq(invites.email, email), isNull(invites.acceptedAt)));
  if (!dup) await db.insert(invites).values({ officeId: user.officeId, email, rights, invitedBy: user.id });
  await log(user, `Added ${email} as a viewer (${rights})`);
  return back(req, "msg=" + encodeURIComponent(`${email} can now register and will join your office.`));
}
