import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual, createCipheriv, createDecipheriv } from "node:crypto";

/** Keys for the credit console are derived from Before the Bell's SESSION_SECRET (one secret to manage). */
function master(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (32+ chars)");
  return "pehla-round-local-dev-credit-secret-000000";
}
function derived(label: string): Buffer {
  return createHmac("sha256", master()).update(label).digest();
}
function secret(): Buffer {
  return derived("credit-auth-v1");
}

/** Keyed hash for login codes and session tokens: a DB leak does not reveal usable tokens. */
export function keyedHash(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function newLoginCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// ---------- TOTP (RFC 6238, SHA-1, 30s, 6 digits: what authenticator apps expect) ----------

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx < 0) throw new Error("bad base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpAt(secretB32: string, timeMs: number): string {
  const counter = Math.floor(timeMs / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secretB32)).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const code = ((h.readUInt32BE(off) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
  return code;
}

/** Accepts the current step and one step either side for clock drift. */
export function verifyTotp(secretB32: string, code: string, nowMs = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  for (const d of [-1, 0, 1]) {
    const expected = totpAt(secretB32, nowMs + d * 30_000);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return true;
  }
  return false;
}

// ---------- TOTP secrets encrypted at rest (AES-256-GCM) ----------

function encKey(): Buffer {
  return derived("credit-totp-v1");
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(blob: string): string {
  const [iv, tag, ct] = blob.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", encKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}
