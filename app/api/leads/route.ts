import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { leads } from "@/db/schema";
import { readBody, str, jerr } from "@/lib/http";
import { notifyDesk } from "@/lib/notify";
import { allowIp, isBot, TOO_MANY } from "@/lib/rate";

export async function POST(req: NextRequest) {
  const { data } = await readBody(req);
  if (isBot(data)) return NextResponse.json({ ok: true });
  if (!(await allowIp("lead", 6, 3600))) return jerr(TOO_MANY, 429);
  const name = str(data.name, 120), email = str(data.email, 200), phone = str(data.phone, 40);
  if (!name || (!email && !phone)) return jerr("Please give your name and an email or mobile number.");
  const rest: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) if (!["name", "email", "phone", "entity", "website"].includes(k)) rest[k] = str(v, k === "report" ? 3000 : 1000);
  const db = await getDb();
  await db.insert(leads).values({ kind: "founder", name, company: str(data.entity, 200) || null, email: email || null, phone: phone || null, data: rest });
  await notifyDesk({ title: `New company lead: ${str(data.entity, 200) || name}`, body: `${name} · ${email} · ${phone}`, link: "/admin/activity#leads" });
  return NextResponse.json({ ok: true });
}
