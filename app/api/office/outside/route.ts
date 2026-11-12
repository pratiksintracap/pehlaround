import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { outsideHoldings, watches } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { str } from "@/lib/http";
import { allow, TOO_MANY } from "@/lib/rate";
import { csvRows, normName, readHoldings } from "@/lib/outside";

export const maxDuration = 30;
const MAX_FILE = 2 * 1024 * 1024;
const back = (req: NextRequest, msg: string, bad = false) => NextResponse.redirect(new URL(`/dashboard?${bad ? "error" : "msg"}=${encodeURIComponent(msg)}#Holdings`, req.url), 303);
const pos = (v: unknown) => { const n = Number(String(v ?? "").replace(/[₹,\s]/g, "")); return isFinite(n) && n > 0 ? n : null; };
const day = (v: unknown) => { const s = str(v, 12); return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : null; };
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

/** An office's record of what it holds outside the desk: add, edit or remove a holding, or import a broker's holdings
 *  file. Private to the office (MODEL.md: outside holdings); nothing here is told to the desk or logged with figures. */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user?.officeId || !user.office) return NextResponse.redirect(new URL("/login?next=/dashboard%23Holdings", req.url), 303);
  if (!/commit/i.test(user.rights)) return back(req, "Your access is view-only. Ask your office's principal to update holdings.", true);
  if (!(await allow(`outside:${user.officeId}`, 120, 3600))) return back(req, TOO_MANY, true);
  const fd = await req.formData().catch(() => null);
  if (!fd) return back(req, "That did not come through. Please try again.", true);
  const db = await getDb();
  const officeId = user.officeId, what = str(fd.get("what"), 20), id = Number(fd.get("id")) || 0;
  const mine = and(eq(outsideHoldings.id, id), eq(outsideHoldings.officeId, officeId));

  if (what === "remove") { await db.delete(outsideHoldings).where(mine); return back(req, "Removed."); }

  if (what === "import") {
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return back(req, "Choose your broker's holdings file.", true);
    if (file.size > MAX_FILE) return back(req, "That file is over 2 MB. Export only your holdings.", true);
    let cells: unknown[][];
    try {
      if (/\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml")) {
        const { readSheet } = await import("read-excel-file/node");
        cells = (await readSheet(Buffer.from(await file.arrayBuffer()))) as unknown[][];
      } else if (/\.(csv|txt|tsv)$/i.test(file.name) || /csv|text\/plain/.test(file.type)) cells = csvRows(await file.text());
      else return back(req, "Upload the holdings file as Excel (.xlsx) or CSV. For an older .xls, open it and save it as .xlsx first.", true);
    } catch { return back(req, "That file could not be read. Export it again as .xlsx or CSV.", true); }
    const r = readHoldings(cells);
    if (r.error) return back(req, r.error, true);
    if (!r.rows.length) return back(req, "No holdings with a quantity were found in that file.", true);
    // An import replaces the previous import; holdings the office added by hand stay.
    await db.delete(outsideHoldings).where(and(eq(outsideHoldings.officeId, officeId), eq(outsideHoldings.source, "import")));
    const via = str(fd.get("via"), 80) || null, on = today();
    await db.insert(outsideHoldings).values(r.rows.map((x) => ({ officeId, userId: user.id, kind: "listed", source: "import", company: x.company, symbol: x.symbol, isin: x.isin, shares: x.shares,
      costPerShare: x.costPerShare, valuePerShare: x.valuePerShare, valuedOn: x.valuePerShare ? on : null, via })));
    return back(req, `Imported ${r.rows.length} listed holding${r.rows.length === 1 ? "" : "s"}${r.skipped ? `; ${r.skipped} line${r.skipped === 1 ? "" : "s"} without a quantity skipped` : ""}. A new import replaces this one.`);
  }

  const company = str(fd.get("company"), 160);
  if (!company) return back(req, "Give the company's name.", true);
  const vals = { company, kind: str(fd.get("kind"), 10) === "listed" ? "listed" : "unlisted", shares: pos(fd.get("shares")), costPerShare: pos(fd.get("costPerShare")),
    boughtOn: day(fd.get("boughtOn")), valuePerShare: pos(fd.get("valuePerShare")), via: str(fd.get("via"), 80) || null, note: str(fd.get("note"), 300) || null, updatedAt: new Date() };
  if (!vals.shares) return back(req, "Enter how many shares you hold.", true);
  const valuedOn = vals.valuePerShare ? today() : null;
  if (what === "edit" && id) {
    const [prev] = await db.select().from(outsideHoldings).where(mine);
    if (!prev) return back(req, "That holding no longer exists.", true);
    await db.update(outsideHoldings).set({ ...vals, valuedOn: vals.valuePerShare !== prev.valuePerShare ? valuedOn : prev.valuedOn }).where(mine);
    return back(req, `${company} updated.`);
  }
  await db.insert(outsideHoldings).values({ officeId, userId: user.id, ...vals, valuedOn });
  // An unlisted holding is followed for IPO news without asking: that is most of the point of recording it.
  if (vals.kind === "unlisted" && normName(company).length >= 3) await db.insert(watches).values({ officeId, userId: user.id, name: company, norm: normName(company) }).onConflictDoNothing();
  return back(req, `${company} added. If it files for an IPO, you will be told.`);
}
