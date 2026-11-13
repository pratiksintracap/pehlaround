import "server-only";
import { createPublicKey, hkdfSync } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { open, privateKeyFromRaw, rawPublic, seal } from "@/lib/agent-crypto";
import { deskAction, deskBrief } from "@/lib/agent-desk";

/*
 * How the desk's scheduled assistant (Claude, running in the cloud) talks to the site without any shared secret:
 *
 *   1. The assistant seals a request to the site's public key and pushes it to the repository's "agent" branch,
 *      with a one-off reply key of its own.
 *   2. The agent workflow hands the sealed bytes to /api/agent/exchange, signed by GitHub's OIDC token for that
 *      workflow in this repository (checked here), so only this repository's workflow can call it.
 *   3. The site opens the request, runs it, and seals the answer to the reply key. Only that one assistant run can
 *      read it, although it is committed to a public branch.
 *
 * The site's key pair is derived from SESSION_SECRET, so there is nothing new to configure; changing that secret
 * rotates it.
 */

const ISSUER = "https://token.actions.githubusercontent.com";
export const AGENT_AUDIENCE = "btb-agent";
const REPO = process.env.AGENT_REPO ?? "pratiksintracap/pehlaround";
const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));

function sitePrivateRaw(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set");
  const k = Buffer.from(hkdfSync("sha256", Buffer.from(s), Buffer.from("beforethebell"), Buffer.from("agent-x25519-v1"), 32));
  k[0] &= 248; k[31] &= 127; k[31] |= 64;
  return k;
}
export const sitePublicRaw = () => rawPublic(createPublicKey(privateKeyFromRaw(sitePrivateRaw())));

export async function verifyWorkflow(header: string | null): Promise<boolean> {
  const token = header?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: ISSUER, audience: AGENT_AUDIENCE });
    const p = payload as Record<string, unknown>;
    return p.repository === REPO && typeof p.job_workflow_ref === "string" && p.job_workflow_ref.startsWith(`${REPO}/.github/workflows/agent.yml@refs/heads/agent`);
  } catch {
    return false;
  }
}

type Request = { v: 1; id: string; at: string; reply: string; actions: Record<string, string>[] };

/** Opens a sealed request, runs its actions in order and returns the sealed answer. */
export async function exchange(sealed: Buffer): Promise<Buffer> {
  const req = JSON.parse(open(sealed, sitePrivateRaw()).toString("utf8")) as Request;
  if (req.v !== 1 || !req.reply || !Array.isArray(req.actions) || req.actions.length > 40) throw new Error("Bad request");
  // A request older than a day is refused, so an old sealed file can never be replayed.
  if (!(Date.now() - Date.parse(req.at) < 864e5)) throw new Error("Request too old");
  const results: unknown[] = [];
  for (const a of req.actions) {
    try { results.push(a.action === "brief" ? await deskBrief() : await deskAction(a)); }
    catch (e) { results.push({ error: e instanceof Error ? e.message : "Failed" }); }
  }
  const body = Buffer.from(JSON.stringify({ id: req.id, at: new Date().toISOString(), results }));
  return seal(body, Buffer.from(req.reply, "base64"));
}
