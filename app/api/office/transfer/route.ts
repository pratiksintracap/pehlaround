import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { kycFiles, offices, transferKyc } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { str } from "@/lib/http";
import { allow, TOO_MANY } from "@/lib/rate";
import { notifyDesk } from "@/lib/notify";
import { cleanDemat, isKycKind, KYC_KINDS, KYC_MIME, MAX_KYC_BYTES } from "@/lib/transfer";

export const maxDuration = 30;

const back = (req: NextRequest, msg: string, bad = false) =>
  NextResponse.redirect(new URL(`/dashboard?${bad ? "error" : "msg"}=${encodeURIComponent(msg)}#Transfer`, req.url), 303);

/** The office's transfer details (demat, bank) and its documents (CML, cancelled cheque, authority). Commit rights only. */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user?.officeId || !user.office) return NextResponse.redirect(new URL("/login?next=/dashboard%23Transfer", req.url), 303);
  if (!/commit/i.test(user.rights)) return back(req, "Only people with commit rights can add transfer details.", true);
  if (!(await allow(`kyc:${user.officeId}`, 30, 3600))) return back(req, TOO_MANY, true);
  const fd = await req.formData().catch(() => null);
  if (!fd) return back(req, "That did not come through. Please try again.", true);
  const db = await getDb();
  const officeId = user.officeId;

  if (fd.get("what") === "details") {
    const g = (k: string, n = 120) => str(fd.get(k), n);
    const dep = g("depository", 10);
    const demat = cleanDemat(dep, g("dpId", 30), g("clientId", 30));
    if (!demat) return back(req, dep.toUpperCase() === "CDSL" ? "For CDSL, enter the 16-digit BO ID." : "For NSDL, the DP ID looks like IN301234 and the client ID has 8 digits.", true);
    const ifsc = g("ifsc", 20).toUpperCase().replace(/\s/g, "");
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return back(req, "That IFSC does not look right: four letters, a zero, then six letters or digits.", true);
    const last4 = g("accountLast4", 10).replace(/\D/g, "");
    if (last4 && last4.length !== 4) return back(req, "Enter only the last four digits of the account number.", true);
    const pan = g("pan", 12).toUpperCase().replace(/\s/g, "");
    if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) return back(req, "That PAN does not look right: five letters, four digits, one letter.", true);
    const row = { holderName: g("holderName", 160) || null, dpName: g("dpName", 120) || null, ...demat, bankName: g("bankName", 120) || null, ifsc: ifsc || null, accountLast4: last4 || null, updatedAt: new Date(), updatedBy: user.name };
    await db.insert(transferKyc).values({ officeId, ...row }).onConflictDoUpdate({ target: transferKyc.officeId, set: row });
    if (pan && pan !== user.office.pan) await db.update(offices).set({ pan, status: "pan_submitted" }).where(eq(offices.id, officeId));
    await log(user, "Saved the office's demat and bank details for share transfers");
    return back(req, "Demat and bank details saved.");
  }

  const kind = fd.get("kind"), file = fd.get("file");
  if (!isKycKind(kind)) return back(req, "Choose which document this is.", true);
  if (!(file instanceof File) || !file.size) return back(req, "Choose a file to upload.", true);
  if (file.size > MAX_KYC_BYTES) return back(req, "That file is over 4 MB. A scan at 150–200 dpi or a phone photo is plenty.", true);
  const mime = file.type || "application/octet-stream";
  if (!KYC_MIME.includes(mime)) return back(req, "Please upload a PDF or a photo (JPG, PNG, HEIC).", true);
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  await db.update(kycFiles).set({ replacedAt: new Date() }).where(and(eq(kycFiles.officeId, officeId), eq(kycFiles.kind, kind), isNull(kycFiles.replacedAt)));
  await db.insert(kycFiles).values({ officeId, kind, name: str(file.name, 160) || `${kind}.pdf`, mime, size: file.size, data, userId: user.id });
  await log(user, `Uploaded the ${KYC_KINDS[kind].label.toLowerCase()} for share transfers`);
  await notifyDesk({ title: `${user.office.name} uploaded a ${KYC_KINDS[kind].label.toLowerCase()}`, body: "Check it on the office's page so the transfer is not held up.", link: `/desk/investors/${officeId}#transfer` }).catch(() => {});
  return back(req, `${KYC_KINDS[kind].label} uploaded. The desk checks it and tells you if anything needs redoing.`);
}
