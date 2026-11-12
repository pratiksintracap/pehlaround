import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { watches } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { str } from "@/lib/http";
import { allow, TOO_MANY } from "@/lib/rate";
import { normName } from "@/lib/outside";

const back = (req: NextRequest, msg: string, bad = false) => NextResponse.redirect(new URL(`/dashboard?${bad ? "error" : "msg"}=${encodeURIComponent(msg)}#Holdings`, req.url), 303);

/** Follow or stop following a company for IPO news. Anyone in the office may; the whole office is told. */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user?.officeId) return NextResponse.redirect(new URL("/login?next=/dashboard%23Holdings", req.url), 303);
  if (!(await allow(`watch:${user.officeId}`, 120, 3600))) return back(req, TOO_MANY, true);
  const fd = await req.formData().catch(() => null);
  const db = await getDb();
  if (fd?.get("what") === "remove") { await db.delete(watches).where(and(eq(watches.id, Number(fd.get("id")) || 0), eq(watches.officeId, user.officeId))); return back(req, "Stopped following."); }
  const name = str(fd?.get("name"), 120), norm = normName(name);
  if (norm.length < 3) return back(req, "Type the company's name.", true);
  if ((await db.select({ id: watches.id }).from(watches).where(eq(watches.officeId, user.officeId))).length >= 100) return back(req, "You follow 100 companies already. Stop following one first.", true);
  await db.insert(watches).values({ officeId: user.officeId, userId: user.id, name, norm }).onConflictDoNothing();
  return back(req, `Following ${name}. You will be told when its IPO dates are out, when it opens, closes and lists.`);
}
