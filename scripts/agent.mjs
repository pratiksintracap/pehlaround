#!/usr/bin/env node
// The desk's scheduled assistant uses this to talk to beforethebell.in through the repository (lib/agent-exchange.ts).
//
//   node scripts/agent.mjs ask '[{"action":"brief"}]'
//   node scripts/agent.mjs ask '[{"action":"task","title":"…","company":"…","dueOn":"2026-11-20","assignee":"Puneet"}]'
//   node scripts/agent.mjs ask '[{"action":"stage","company":"…","stage":"docs","note":"term sheet sent"}]'
//
// "ask" seals the request to the site's key (agent/site.pub), pushes it to the "agent" branch, waits for the agent
// workflow to relay it, and prints the opened answer as JSON. Run it from a clone of the repository with push access.
// "relay" is what the workflow runs: it hands each waiting request to the site and commits the sealed answers.
import { createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const MAGIC = Buffer.from("BTBX1");
const SPKI = Buffer.from("302a300506032b656e032100", "hex");
const PKCS8 = Buffer.from("302e020100300506032b656e04220420", "hex");
const INFO = Buffer.from("btb-agent-v1");
const pubFromRaw = (raw) => createPublicKey({ key: Buffer.concat([SPKI, raw]), format: "der", type: "spki" });
const rawPub = (k) => k.export({ format: "der", type: "spki" }).subarray(SPKI.length);
const keyFor = (shared, eph) => Buffer.from(hkdfSync("sha256", shared, eph, INFO, 32));
function seal(plain, toRaw) {
  const e = generateKeyPairSync("x25519"), ep = rawPub(e.publicKey), iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFor(diffieHellman({ privateKey: e.privateKey, publicKey: pubFromRaw(toRaw) }), ep), iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, ep, iv, c.getAuthTag(), body]);
}
function open(sealed, privKey) {
  if (!sealed.subarray(0, 5).equals(MAGIC)) throw new Error("Not a sealed message");
  const ep = sealed.subarray(5, 37), iv = sealed.subarray(37, 49), tag = sealed.subarray(49, 65);
  const d = createDecipheriv("aes-256-gcm", keyFor(diffieHellman({ privateKey: privKey, publicKey: pubFromRaw(ep) }), ep), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(sealed.subarray(65)), d.final()]);
}
const git = (...a) => execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SITE = process.env.SITE_URL ?? "https://beforethebell.in";

async function ask(json) {
  const actions = JSON.parse(json);
  if (!Array.isArray(actions)) throw new Error("Pass a JSON array of actions");
  git("fetch", "-q", "origin", "agent");
  const pub = Buffer.from(git("show", "origin/agent:agent/site.pub"), "base64");
  const reply = generateKeyPairSync("x25519");
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const body = Buffer.from(JSON.stringify({ v: 1, id, at: new Date().toISOString(), reply: rawPub(reply.publicKey).toString("base64"), actions }));
  // Work in a separate worktree so the caller's checkout is untouched.
  const wt = `/tmp/btb-agent-${id}`;
  git("worktree", "add", "-q", "--detach", wt, "origin/agent");
  try {
    mkdirSync(`${wt}/agent/requests`, { recursive: true });
    writeFileSync(`${wt}/agent/requests/${id}.btb`, seal(body, pub));
    execFileSync("git", ["-C", wt, "add", "agent/requests"]);
    execFileSync("git", ["-C", wt, "-c", "user.name=Desk assistant", "-c", "user.email=desk@beforethebell.in", "commit", "-q", "-m", `agent: request ${id}`]);
    for (let i = 0; ; i++) {
      try { execFileSync("git", ["-C", wt, "push", "-q", "origin", "HEAD:agent"], { stdio: "pipe" }); break; }
      catch (e) { if (i > 3) throw e; execFileSync("git", ["-C", wt, "pull", "-q", "--rebase", "origin", "agent"], { stdio: "pipe" }); }
    }
  } finally { git("worktree", "remove", "--force", wt); }
  // Wait for the workflow (usually under a minute).
  for (let t = 0; t < 60; t++) {
    await sleep(6000);
    git("fetch", "-q", "origin", "agent");
    let raw = null;
    try { raw = execFileSync("git", ["show", `origin/agent:agent/responses/${id}.btb`], { stdio: ["ignore", "pipe", "ignore"] }); } catch { /* not yet */ }
    if (raw) { process.stdout.write(open(raw, reply.privateKey).toString("utf8") + "\n"); return; }
    try {
      const err = execFileSync("git", ["show", `origin/agent:agent/responses/${id}.error`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      throw new Error(`The site refused the request: ${err.trim()}`);
    } catch (e) { if (String(e.message).startsWith("The site")) throw e; }
  }
  throw new Error("No answer after six minutes: check the Agent workflow run on GitHub.");
}

async function oidc() {
  const r = await fetch(`${process.env.ACTIONS_ID_TOKEN_REQUEST_URL}&audience=btb-agent`, { headers: { Authorization: `bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` } });
  if (!r.ok) throw new Error(`OIDC token: ${r.status}`);
  return (await r.json()).value;
}

async function relay() {
  mkdirSync("agent/responses", { recursive: true });
  const k = await fetch(`${SITE}/api/agent/exchange`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (k?.publicKey) writeFileSync("agent/site.pub", `${k.publicKey}\n`);
  const dir = "agent/requests";
  let failed = 0;
  for (const f of existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith(".btb")) : []) {
    const id = f.replace(/\.btb$/, "");
    let res = null;
    for (let i = 1; i <= 3; i++) {
      res = await fetch(`${SITE}/api/agent/exchange`, { method: "POST", headers: { Authorization: `Bearer ${await oidc()}`, "Content-Type": "application/octet-stream" }, body: readFileSync(`${dir}/${f}`) })
        .catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
      if (res.ok || (res.status >= 400 && res.status < 500)) break;
      await sleep(3000 * i);
    }
    if (res.ok) writeFileSync(`agent/responses/${id}.btb`, Buffer.from(await res.arrayBuffer()));
    else { failed++; writeFileSync(`agent/responses/${id}.error`, `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}\n`); }
    rmSync(`${dir}/${f}`);
    console.log(`${id}: ${res.ok ? "answered" : `failed (${res.status})`}`); // ids only: the branch and the log are public
  }
  // Answers older than three days are removed; each is useful only to the run that asked.
  for (const f of readdirSync("agent/responses")) {
    const t = Date.parse(f.slice(0, 19).replace(/-(\d\d)-(\d\d)$/, ":$1:$2").replace(/T(\d\d)-/, "T$1:"));
    if (t && Date.now() - t > 3 * 864e5) rmSync(`agent/responses/${f}`);
  }
  process.exitCode = failed ? 1 : 0;
}

const [cmd, arg] = process.argv.slice(2);
(cmd === "ask" ? ask(arg ?? '[{"action":"brief"}]') : cmd === "relay" ? relay() : Promise.reject(new Error("Use: ask '<json>' | relay")))
  .catch((e) => { console.error(e.message); process.exit(1); });
