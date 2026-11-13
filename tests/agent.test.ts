// The assistant's sealed exchange: a request sealed to the site's key is opened, run and answered sealed to the
// request's own reply key; stale or tampered requests are refused.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
process.env.SESSION_SECRET ??= "test-session-secret-0123456789abcdef0123456789";
import { open, rawPublic, seal } from "@/lib/agent-crypto";
import { exchange, sitePublicRaw } from "@/lib/agent-exchange";

const ask = async (actions: Record<string, unknown>[], at = new Date().toISOString()) => {
  const reply = generateKeyPairSync("x25519");
  const req = { v: 1, id: "t1", at, reply: rawPublic(reply.publicKey).toString("base64"), actions };
  const out = await exchange(seal(Buffer.from(JSON.stringify(req)), sitePublicRaw()));
  const raw = (reply.privateKey.export({ format: "der", type: "pkcs8" }) as Buffer).subarray(16);
  return JSON.parse(open(out, raw).toString("utf8")) as { id: string; results: Record<string, unknown>[] };
};

test("a sealed request is answered, sealed to its own reply key", async () => {
  const r = await ask([{ action: "brief" }, { action: "task", title: "Call the CFO back", dueOn: "2026-11-20" }, { action: "nonsense" }]);
  assert.equal(r.id, "t1");
  assert.ok(Array.isArray((r.results[0] as { pipeline: unknown[] }).pipeline));
  assert.equal((r.results[1] as { ok: boolean }).ok, true);
  assert.ok((r.results[2] as { error: string }).error);
});

test("old or tampered requests are refused", async () => {
  await assert.rejects(ask([{ action: "brief" }], new Date(Date.now() - 2 * 864e5).toISOString()), /too old/);
  const sealed = seal(Buffer.from("{}"), sitePublicRaw());
  sealed[sealed.length - 1] ^= 1;
  await assert.rejects(exchange(sealed));
});
