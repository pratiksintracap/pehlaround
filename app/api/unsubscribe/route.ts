import { type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { offices, users } from "@/db/schema";
import { unsubUser } from "@/lib/email";
import { unsubscribeToken } from "@/lib/digest";

export const dynamic = "force-dynamic";
const page = (title: string, body: string) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="margin:0;background:#f4f6fb;font-family:Georgia,serif;color:#141c33"><div style="max-width:520px;margin:12vh auto;background:#fff;border-radius:14px;padding:32px 28px;box-shadow:0 4px 24px rgba(20,28,51,.08)">
<p style="font:600 12px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8a6d2f;margin:0 0 14px">Before the Bell</p>
<h1 style="font-size:26px;margin:0 0 12px">${title}</h1><p style="font:16px/1.6 system-ui,sans-serif;color:#3b4663">${body}</p>
<p style="margin:22px 0 0"><a href="/dashboard" style="font:600 15px system-ui,sans-serif;color:#1d3a8a">Open your dashboard</a></p></div></body>`,
  { headers: { "content-type": "text/html; charset=utf-8" } });

async function run(req: NextRequest) {
  // Public subscribers (articles by email) carry a token of their own.
  const s = req.nextUrl.searchParams.get("s");
  if (s) return (await unsubscribeToken(s))
    ? page("You're unsubscribed", "The desk's articles will no longer reach you by email. You can read them any time at beforethebell.in/articles.")
    : page("That link has expired", "If you still receive the articles, write to the desk and we will take you off the list.");
  const id = unsubUser(req.nextUrl.searchParams.get("t") || "");
  if (!id) return page("That link has expired", "Please change your email preferences from your dashboard, or write to the desk.");
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u?.officeId) return page("That link has expired", "Please change your email preferences from your dashboard, or write to the desk.");
  const [o] = await db.select().from(offices).where(eq(offices.id, u.officeId));
  await db.update(offices).set({ consents: { ...(o?.consents ?? {}), email: false } as typeof o.consents }).where(eq(offices.id, u.officeId));
  return page("You're unsubscribed", "The desk will no longer send your office updates by email. Signed NDAs and anything you ask for will still reach you. You can switch updates back on from your dashboard.");
}
export const GET = run;
export const POST = run; // one-click unsubscribe from mail apps
