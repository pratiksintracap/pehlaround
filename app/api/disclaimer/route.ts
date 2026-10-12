import { NextResponse, type NextRequest } from "next/server";
import { getUser, log } from "@/lib/auth";
import { readBody, str } from "@/lib/http";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: true });
  const { data } = await readBody(req);
  await log(user, `Accepted the site disclaimer (version ${str(data.version, 20)})`);
  return NextResponse.json({ ok: true });
}
