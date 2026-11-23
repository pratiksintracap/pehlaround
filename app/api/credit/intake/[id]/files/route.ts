import { formRoute } from "@/lib/credit/server/intake/http";
import { startUpload } from "@/lib/credit/server/intake/partner";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return formRoute(req, async (actor) => startUpload(actor, id, await req.json().catch(() => ({}))));
}
