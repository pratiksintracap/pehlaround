import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { kycFiles, offices, transferKyc } from "@/db/schema";

// Transfer readiness: what an office must give the desk before shares can move to its demat. Kept once per office.

export const KYC_KINDS = {
  cml: { label: "Client master list (CML)", hint: "From your broker or DP, signed and stamped. It shows the demat account the shares go to." },
  cheque: { label: "Cancelled cheque", hint: "Of the account the payment comes from, in the investing entity's name." },
  authority: { label: "Authority to invest", hint: "Board resolution (company), partners' resolution (LLP) or trustees' resolution (trust), naming who signs." },
} as const;
export type KycKind = keyof typeof KYC_KINDS;
export const isKycKind = (k: unknown): k is KycKind => typeof k === "string" && k in KYC_KINDS;

export const MAX_KYC_BYTES = 4 * 1024 * 1024;
export const KYC_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

/** Companies, LLPs, trusts and AIFs also need the authority to invest; individuals and HUFs do not. */
export const needsAuthority = (category?: string | null) => !!category && !["Individual", "HUF"].includes(category);

/** Cleans demat ids: NSDL "IN301234" + 8 digits; CDSL a 16-digit BO ID (split into its two halves). Null when they do not fit. */
export function cleanDemat(depository: string, dpId: string, clientId: string) {
  const d = depository.toUpperCase();
  if (d === "CDSL") {
    const bo = (dpId + clientId).replace(/\D/g, "");
    return bo.length === 16 ? { depository: d, dpId: bo.slice(0, 8), clientId: bo.slice(8) } : null;
  }
  if (d === "NSDL") {
    const dp = dpId.replace(/\s/g, "").toUpperCase(), cl = clientId.replace(/\D/g, "");
    return /^IN\d{6}$/.test(dp) && /^\d{8}$/.test(cl) ? { depository: d, dpId: dp, clientId: cl } : null;
  }
  return null;
}

export type Item = { key: "pan" | "demat" | KycKind; label: string; state: "done" | "checked" | "redo" | "missing"; note?: string | null };
export type Readiness = { items: Item[]; done: number; total: number; ready: boolean; checked: boolean };

type Office = Pick<typeof offices.$inferSelect, "id" | "pan" | "status" | "category">;
type Kyc = typeof transferKyc.$inferSelect | undefined;
type FileRow = Pick<typeof kycFiles.$inferSelect, "id" | "kind" | "status" | "deskNote" | "name" | "size" | "at" | "checkedAt">;

/** The checklist for one office from its rows. "checked" means the desk has accepted every file. */
export function readiness(o: Office, k: Kyc, files: FileRow[]): Readiness {
  const latest = (kind: KycKind) => files.find((f) => f.kind === kind);
  const fileItem = (kind: KycKind): Item => {
    const f = latest(kind);
    return { key: kind, label: KYC_KINDS[kind].label, state: !f ? "missing" : f.status === "redo" ? "redo" : f.status === "accepted" ? "checked" : "done", note: f?.status === "redo" ? f.deskNote : null };
  };
  const items: Item[] = [
    { key: "pan", label: "PAN of the investing entity", state: o.status === "verified" ? "checked" : o.pan ? "done" : "missing" },
    { key: "demat", label: "Demat account details", state: k?.dpId && k.clientId ? "done" : "missing" },
    fileItem("cml"),
    fileItem("cheque"),
    ...(needsAuthority(o.category) ? [fileItem("authority")] : []),
  ];
  const done = items.filter((i) => i.state === "done" || i.state === "checked").length;
  return { items, done, total: items.length, ready: done === items.length, checked: items.every((i) => i.state === "checked" || i.key === "demat" && i.state === "done") };
}

/** One office's details and current files (newest first, replaced ones left out), without file contents. */
export async function officeTransfer(officeId: number) {
  const db = await getDb();
  const [[k], files] = await Promise.all([
    db.select().from(transferKyc).where(eq(transferKyc.officeId, officeId)),
    db.select({ id: kycFiles.id, kind: kycFiles.kind, status: kycFiles.status, deskNote: kycFiles.deskNote, name: kycFiles.name, size: kycFiles.size, at: kycFiles.at, checkedAt: kycFiles.checkedAt, checkedBy: kycFiles.checkedBy })
      .from(kycFiles).where(and(eq(kycFiles.officeId, officeId), isNull(kycFiles.replacedAt))).orderBy(desc(kycFiles.at)),
  ]);
  return { kyc: k, files };
}

/** Readiness for many offices at once, for the desk's deal and investor pages. */
export async function readinessFor(officeIds: number[]) {
  const out = new Map<number, Readiness>();
  if (!officeIds.length) return out;
  const db = await getDb();
  const [os, ks, fs] = await Promise.all([
    db.select({ id: offices.id, pan: offices.pan, status: offices.status, category: offices.category }).from(offices).where(inArray(offices.id, officeIds)),
    db.select().from(transferKyc).where(inArray(transferKyc.officeId, officeIds)),
    db.select({ id: kycFiles.id, officeId: kycFiles.officeId, kind: kycFiles.kind, status: kycFiles.status, deskNote: kycFiles.deskNote, name: kycFiles.name, size: kycFiles.size, at: kycFiles.at, checkedAt: kycFiles.checkedAt })
      .from(kycFiles).where(and(inArray(kycFiles.officeId, officeIds), isNull(kycFiles.replacedAt))).orderBy(desc(kycFiles.at)),
  ]);
  for (const o of os) out.set(o.id, readiness(o, ks.find((k) => k.officeId === o.id), fs.filter((f) => f.officeId === o.id)));
  return out;
}

export const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
