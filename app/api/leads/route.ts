import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { leads } from "@/db/schema";
import { readBody, str, jerr } from "@/lib/http";

export async function POST(req: NextRequest) {
  const { data } = await readBody(req);
  const name = str(data.name, 120), email = str(data.email, 200), phone = str(data.phone, 40);
  if (!name || (!email && !phone)) return jerr("Please give your name and an email or mobile number.");
  const rest: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) if (!["name", "email", "phone", "entity"].includes(k)) rest[k] = str(v, 1000);
  const db = await getDb();
  await db.insert(leads).values({ kind: "founder", name, company: str(data.entity, 200) || null, email: email || null, phone: phone || null, data: rest });
  return NextResponse.json({ ok: true });
}
