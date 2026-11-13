import { NextResponse } from "next/server";
import { exchange, sitePublicRaw, verifyWorkflow } from "@/lib/agent-exchange";

// The agent workflow's one door into the site (lib/agent-exchange.ts). GET gives the public key requests are sealed to.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ alg: "x25519-hkdf-sha256-aes256gcm", publicKey: sitePublicRaw().toString("base64") }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!(await verifyWorkflow(req.headers.get("authorization")))) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > 256 * 1024) return NextResponse.json({ error: "Too large." }, { status: 413 });
  try {
    const out = await exchange(body);
    return new NextResponse(new Uint8Array(out), { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
