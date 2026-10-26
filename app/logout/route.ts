import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await destroySession();
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.delete("pr_peek");
  return res;
}
