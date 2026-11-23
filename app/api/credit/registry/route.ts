import { NextResponse } from "next/server";
import { registryLookup } from "@/lib/credit/server/intake/public";

/** Look up an NBFC in RBI's public register by CIN or name, to fill in the rest of its details. Public data. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const rows = await registryLookup(q);
  return NextResponse.json(
    rows.map((r) => ({ name: r.name, cin: r.cin, rbiRegNo: r.rbi_reg_no, state: r.state, office: r.regional_office, type: r.classification, layer: r.layer })),
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
