import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { offices } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { readBody } from "@/lib/http";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user?.officeId) return NextResponse.redirect(new URL("/login", req.url), 303);
  const { data } = await readBody(req);
  const consents = { email: data.email === "on", wa: data.wa === "on", calls: data.calls === "on" };
  const db = await getDb();
  await db.update(offices).set({ consents }).where(eq(offices.id, user.officeId));
  await log(user, `Updated consents: email ${consents.email ? "on" : "off"}, WhatsApp ${consents.wa ? "on" : "off"}, calls ${consents.calls ? "on" : "off"}`);
  return NextResponse.redirect(new URL("/dashboard?msg=" + encodeURIComponent("Consents saved.") + "#Team", req.url), 303);
}
