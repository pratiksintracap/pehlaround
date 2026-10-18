import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const PLATFORMS = ["ios", "android"] as const;
export const newSecret = () => randomBytes(32).toString("base64url");
export const hashSecret = (s: string) => createHash("sha256").update("btb-app|" + s).digest("hex");
export function sameHash(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
