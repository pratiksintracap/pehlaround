import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { blobs } from "@/lib/credit/schema";

/*
 * Diligence document storage. Files are never served from a public path: they are read only through the
 * permission-checked /api/credit/documents/[id] handler. Contents live in the credit_blobs table (base64), which the
 * restricted credit_app role cannot see; these helpers use the app's own connection and are called only after the
 * caller has checked the user may touch the file.
 */

/** Vercel caps request bodies at 4.5 MB, so set UPLOAD_MAX_MB=4 there; self-hosted can allow more. */
export const MAX_UPLOAD_BYTES = Number(process.env.UPLOAD_MAX_MB ?? 4) * 1024 * 1024;
/*
 * Content check: the file's first bytes must match its extension. The browser-reported type is ignored, and
 * the stored content type comes from this check, so a renamed executable can't be served as a PDF.
 * Not a virus scan: production should add one (e.g. ClamAV) before files are stored.
 */
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const RULES: { ext: string[]; type: string; magic?: number[] }[] = [
  { ext: ["pdf"], type: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { ext: ["png"], type: "image/png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: ["jpg", "jpeg"], type: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  { ext: ["xlsx"], type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", magic: ZIP },
  { ext: ["docx"], type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: ZIP },
  { ext: ["xls"], type: "application/vnd.ms-excel", magic: OLE },
  { ext: ["zip"], type: "application/zip", magic: ZIP },
  { ext: ["csv"], type: "text/csv" },
];

export function checkFileContent(filename: string, data: Buffer): string | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const rule = RULES.find((r) => r.ext.includes(ext));
  if (!rule) return null;
  if (rule.magic && rule.magic.every((b, i) => data[i] === b)) return rule.type;
  // Many banks' ".xls" statements are really tab-separated text or HTML: accepted as text (served only as a download).
  if (ext === "xls") return data.subarray(0, 8192).includes(0) ? null : rule.type;
  if (rule.magic) return null;
  // CSV: must be text (no NUL bytes in the first 8 KB).
  return data.subarray(0, 8192).includes(0) ? null : rule.type;
}

const KEY_RE = /^\d{4}-\d{2}\/[0-9a-f-]{36}$/;

export async function putObject(data: Buffer): Promise<{ key: string; sha256: string }> {
  const key = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}`;
  const sha256 = createHash("sha256").update(data).digest("hex");
  const db = await getDb();
  await db.insert(blobs).values({ key, data: data.toString("base64"), sizeBytes: data.length });
  return { key, sha256 };
}

/** Stores a file under a key carried over from the old console (data move), keeping the documents' references. */
export async function putObjectAt(key: string, data: Buffer): Promise<void> {
  if (!KEY_RE.test(key)) throw new Error("bad storage key");
  const db = await getDb();
  await db.insert(blobs).values({ key, data: data.toString("base64"), sizeBytes: data.length }).onConflictDoNothing();
}

export async function getObject(key: string): Promise<Buffer> {
  if (!KEY_RE.test(key)) throw new Error("bad storage key");
  const db = await getDb();
  const [row] = await db.select({ data: blobs.data }).from(blobs).where(eq(blobs.key, key)).limit(1);
  if (!row) throw new Error("file not found");
  return Buffer.from(row.data, "base64");
}

export async function deleteObject(key: string): Promise<void> {
  if (!KEY_RE.test(key)) throw new Error("bad storage key");
  const db = await getDb();
  await db.delete(blobs).where(eq(blobs.key, key));
}
