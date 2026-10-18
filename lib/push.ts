import "server-only";
import { createSign } from "node:crypto";
import { and, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appDevices, users } from "@/db/schema";

// Push to the Before the Bell app through Firebase Cloud Messaging (HTTP v1), which reaches both Android
// and iPhone (Firebase forwards to Apple). FCM_SERVICE_ACCOUNT holds the Firebase service-account JSON,
// plain or base64. Without it, push is simply off and everything else carries on.
type SA = { client_email: string; private_key: string; project_id: string };
let sa: SA | null | undefined;
function account(): SA | null {
  if (sa !== undefined) return sa;
  const raw = process.env.FCM_SERVICE_ACCOUNT?.trim();
  try { sa = raw ? JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) : null; } catch { sa = null; }
  return sa ?? null;
}
export const pushReady = () => !!account();

let tok: { v: string; exp: number } | null = null;
async function accessToken(a: SA) {
  if (tok && tok.exp > Date.now() + 60_000) return tok.v;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: a.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(a.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`FCM auth failed: ${r.status}`);
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return tok.v;
}

export type Push = { title: string; body?: string | null; link?: string | null };

/** Sends to every live app device of these users. Tokens FCM reports as dead are dropped. Never throws. */
export async function pushToUsers(userIds: number[], m: Push) {
  const a = account(); const ids = [...new Set(userIds)].filter(Boolean);
  if (!a || !ids.length) return 0;
  try {
    const db = await getDb();
    const devs = await db.select({ id: appDevices.id, token: appDevices.pushToken }).from(appDevices)
      .where(and(inArray(appDevices.userId, ids), isNotNull(appDevices.pushToken), isNull(appDevices.revokedAt)));
    if (!devs.length) return 0;
    const at = await accessToken(a);
    let sent = 0;
    for (const d of devs) {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project_id}/messages:send`, {
        method: "POST", headers: { authorization: `Bearer ${at}`, "content-type": "application/json" },
        body: JSON.stringify({ message: {
          token: d.token,
          notification: { title: m.title.slice(0, 120), body: (m.body ?? "").slice(0, 300) },
          data: { link: m.link || "/dashboard" },
          android: { priority: "high", notification: { channel_id: "desk", color: "#0b1730" } },
          apns: { payload: { aps: { sound: "default" } } },
        } }),
      }).catch(() => null);
      if (r?.ok) { sent++; continue; }
      const err = r ? await r.json().catch(() => ({})) : {};
      const code = JSON.stringify(err);
      if (r && (r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(code))) await db.update(appDevices).set({ pushToken: null }).where(eq(appDevices.id, d.id));
    }
    return sent;
  } catch { return 0; }
}

/** Every live user of these offices. */
export async function officeUserIds(officeIds: number[]) {
  if (!officeIds.length) return [];
  const db = await getDb();
  return (await db.select({ id: users.id }).from(users).where(and(inArray(users.officeId, officeIds), eq(users.disabled, false)))).map((r) => r.id);
}
