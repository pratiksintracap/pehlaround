import { NextResponse, type NextRequest } from "next/server";

/** Short invitation links: /invite/<token> opens registration with the invitation applied. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return NextResponse.redirect(new URL(`/register?invite=${encodeURIComponent(token)}`, req.url));
}
