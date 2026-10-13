import "server-only";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

// Sign in with Google or Microsoft (OpenID Connect, authorisation code with PKCE).
// A provider shows on the site only when its client ID and secret are set in the environment.
type Provider = { id: "google" | "microsoft"; name: string; auth: string; token: string; jwks: string; scope: string; env: [string, string] };
const MOCK = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(process.env.OAUTH_MOCK_URL || "") ? process.env.OAUTH_MOCK_URL : undefined; // local tests only

const P: Record<string, Provider> = {
  google: { id: "google", name: "Google", auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", jwks: "https://www.googleapis.com/oauth2/v3/certs", scope: "openid email profile", env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  microsoft: { id: "microsoft", name: "Microsoft", auth: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", token: "https://login.microsoftonline.com/common/oauth2/v2.0/token", jwks: "https://login.microsoftonline.com/common/discovery/v2.0/keys", scope: "openid email profile", env: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"] },
};
const ep = (p: Provider) => MOCK ? { auth: `${MOCK}/${p.id}/auth`, token: `${MOCK}/${p.id}/token`, jwks: `${MOCK}/${p.id}/jwks` } : p;

export function provider(id: string) {
  const p = P[id];
  if (!p) return null;
  const clientId = process.env[p.env[0]], secret = process.env[p.env[1]];
  return clientId && secret ? { ...p, ...ep(p), clientId, secret } : null;
}
/** Providers switched on, for the sign-in and registration pages. */
export const providers = () => Object.keys(P).map(provider).filter((p): p is NonNullable<ReturnType<typeof provider>> => !!p).map((p) => ({ id: p.id, name: p.name }));

const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const MS_CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad";

/** Exchanges the code for an ID token and returns a verified email and name, or an error to show. */
export async function finish(p: NonNullable<ReturnType<typeof provider>>, code: string, verifier: string, nonce: string, redirectUri: string) {
  const r = await fetch(p.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: p.clientId, client_secret: p.secret, code_verifier: verifier }) });
  const j = (await r.json().catch(() => ({}))) as { id_token?: string; error_description?: string };
  if (!r.ok || !j.id_token) return { error: `${p.name} did not confirm the sign-in. Please try again.` };
  if (!jwks.has(p.jwks)) jwks.set(p.jwks, createRemoteJWKSet(new URL(p.jwks)));
  let c: JWTPayload & Record<string, unknown>;
  try { c = (await jwtVerify(j.id_token, jwks.get(p.jwks)!, { audience: p.clientId })).payload as JWTPayload & Record<string, unknown>; }
  catch { return { error: `${p.name}'s answer could not be verified. Please try again.` }; }
  if (c.nonce !== nonce) return { error: "The sign-in expired. Please try again." };
  if (p.id === "google") {
    if (!MOCK && c.iss !== "https://accounts.google.com" && c.iss !== "accounts.google.com") return { error: "Unexpected issuer." };
    if (c.email_verified !== true || typeof c.email !== "string") return { error: "Google did not confirm this email address. Use an email code instead." };
  } else {
    if (!MOCK && !(typeof c.iss === "string" && /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]+\/v2\.0$/.test(c.iss) && c.iss.includes(String(c.tid)))) return { error: "Unexpected issuer." };
    // Work accounts can carry an email their organisation never verified; trust it only for personal accounts
    // or when Microsoft marks the domain as verified (the xms_edov optional claim).
    const verified = c.tid === MS_CONSUMER_TENANT || c.xms_edov === true || c.xms_edov === "1" || c.xms_edov === 1;
    if (!verified || typeof c.email !== "string") return { error: "Microsoft did not confirm this email address for your organisation. Use an email code instead." };
  }
  return { email: String(c.email).toLowerCase(), name: typeof c.name === "string" ? c.name : "" };
}
