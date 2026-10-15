import { type NextRequest } from "next/server";
import { readBody, str, done, fail } from "@/lib/http";
import { allowIp, isBot, TOO_MANY } from "@/lib/rate";
import { subscribe } from "@/lib/digest";

export const dynamic = "force-dynamic";
/** "Articles by email" on /articles. */
export async function POST(req: NextRequest) {
  const { data, json } = await readBody(req);
  if (isBot(data)) return done(req, json, "/articles?subscribed=1");
  if (!(await allowIp("subscribe", 10, 3600))) return fail(req, json, TOO_MANY, "/articles", 429);
  const r = await subscribe(str(data.email, 200), str(data.name, 120));
  if (!r.ok) return fail(req, json, r.error, "/articles");
  return done(req, json, "/articles?subscribed=1");
}
