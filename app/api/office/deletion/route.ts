import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { leads } from "@/db/schema";
import { getUser, log } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user?.officeId) return NextResponse.redirect(new URL("/login", req.url), 303);
  const db = await getDb();
  await db.insert(leads).values({ kind: "deletion", name: user.name, company: user.office?.name ?? null, email: user.email, phone: user.phone, data: { officeId: String(user.officeId) } });
  await log(user, "Requested deletion of the office's data");
  return NextResponse.redirect(new URL("/dashboard?msg=" + encodeURIComponent("Deletion requested. The desk will confirm by email, keeping only the records the law requires.") + "#Team", req.url), 303);
}
