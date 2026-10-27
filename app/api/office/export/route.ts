import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, calls, interests, ndas, passes, questions, users, kycFiles, transferKyc } from "@/db/schema";
import { getUser, log } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user?.officeId) return NextResponse.redirect(new URL("/login", req.url));
  const db = await getDb(), id = user.officeId;
  const strip = <T extends { passwordHash?: string }>(u: T) => { const { passwordHash: _p, ...r } = u; void _p; return r; };
  const out = {
    exportedAt: new Date().toISOString(), office: user.office,
    people: (await db.select().from(users).where(eq(users.officeId, id))).map(strip),
    ndas: await db.select().from(ndas).where(eq(ndas.officeId, id)),
    interests: await db.select().from(interests).where(eq(interests.officeId, id)),
    passes: await db.select().from(passes).where(eq(passes.officeId, id)),
    questions: await db.select().from(questions).where(eq(questions.officeId, id)),
    calls: await db.select().from(calls).where(eq(calls.officeId, id)),
    log: await db.select().from(audit).where(eq(audit.officeId, id)),
    transferDetails: (await db.select().from(transferKyc).where(eq(transferKyc.officeId, id)))[0] ?? null,
    transferDocuments: await db.select({ id: kycFiles.id, kind: kycFiles.kind, name: kycFiles.name, size: kycFiles.size, status: kycFiles.status, at: kycFiles.at, replacedAt: kycFiles.replacedAt }).from(kycFiles).where(eq(kycFiles.officeId, id)),
  };
  await log(user, "Downloaded the office's data");
  return new NextResponse(JSON.stringify(out, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="off-market-desk-${id}.json"` } });
}
