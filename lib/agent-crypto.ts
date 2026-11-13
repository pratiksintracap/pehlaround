/*
 * Sealed messages between the desk and its scheduled assistant: X25519 + HKDF-SHA256 + AES-256-GCM, Node crypto only.
 * Format: "BTBX1" | ephemeral public key (32) | iv (12) | tag (16) | ciphertext.
 * Mirrored in scripts/agent.mjs (plain Node, used by the assistant and the workflow).
 */
import { createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes, type KeyObject } from "node:crypto";

const MAGIC = Buffer.from("BTBX1");
const SPKI = Buffer.from("302a300506032b656e032100", "hex");
const PKCS8 = Buffer.from("302e020100300506032b656e04220420", "hex");
const INFO = Buffer.from("btb-agent-v1");

export const publicKeyFromRaw = (raw: Buffer): KeyObject => createPublicKey({ key: Buffer.concat([SPKI, raw]), format: "der", type: "spki" });
export const privateKeyFromRaw = (raw: Buffer): KeyObject => createPrivateKey({ key: Buffer.concat([PKCS8, raw]), format: "der", type: "pkcs8" });
export const rawPublic = (k: KeyObject): Buffer => (k.export({ format: "der", type: "spki" }) as Buffer).subarray(SPKI.length);

function keyFor(shared: Buffer, ephPub: Buffer) {
  return Buffer.from(hkdfSync("sha256", shared, ephPub, INFO, 32));
}

export function seal(plain: Buffer, recipientPublicRaw: Buffer): Buffer {
  const eph = generateKeyPairSync("x25519");
  const ephPub = rawPublic(eph.publicKey);
  const shared = diffieHellman({ privateKey: eph.privateKey, publicKey: publicKeyFromRaw(recipientPublicRaw) });
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFor(shared, ephPub), iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, ephPub, iv, c.getAuthTag(), body]);
}

export function open(sealed: Buffer, privateRaw: Buffer): Buffer {
  if (sealed.length < 65 || !sealed.subarray(0, 5).equals(MAGIC)) throw new Error("Not a sealed message");
  const ephPub = sealed.subarray(5, 37);
  const iv = sealed.subarray(37, 49);
  const tag = sealed.subarray(49, 65);
  const shared = diffieHellman({ privateKey: privateKeyFromRaw(privateRaw), publicKey: publicKeyFromRaw(ephPub) });
  const d = createDecipheriv("aes-256-gcm", keyFor(shared, ephPub), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(sealed.subarray(65)), d.final()]);
}
