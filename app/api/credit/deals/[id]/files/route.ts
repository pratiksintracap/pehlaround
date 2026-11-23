import { adminRoute } from "@/lib/credit/server/intake/http";
import { startDealUpload } from "@/lib/credit/server/admin/direct-deals";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return adminRoute(req, async (a) => startDealUpload(a, id, await req.json().catch(() => ({}))));
}
