import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL("/", req.url), 303);
}
