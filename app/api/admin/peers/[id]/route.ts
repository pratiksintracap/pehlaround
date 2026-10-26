import { NextResponse, type NextRequest, after } from "next/server";
import { requirePerm } from "@/lib/auth";
import { aiReady } from "@/lib/ai";
import { draftPeerCompare } from "@/lib/peer-draft";
import { getDb } from "@/lib/db";
import { deskNotes } from "@/db/schema";

// Desk only: starts an AI draft of a deal's peer comparison and returns at once; the draft lands in the room's
// own comparison (and a desk note) a few minutes later.
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("deals.edit");
  const id = Number((await params).id);
  const back = (msg: string) => NextResponse.redirect(new URL(`/admin/deals/${id}?msg=${encodeURIComponent(msg)}#compare`, req.url), 303);
  if (!aiReady()) return back("The AI analyst is not set up (no API key).");
  after(async () => {
    try { await draftPeerCompare(id, { id: me.id, name: me.name }); }
    catch (e) { const db = await getDb(); await db.insert(deskNotes).values({ dealId: id, body: `Peer comparison draft failed: ${(e as Error).message}`, userId: me.id, who: "AI analyst" }).catch(() => 0); }
  });
  return back("Drafting the peer comparison. It takes two to four minutes; refresh this page to see it in the Peer comparison box, and a desk note says when it is done.");
}
