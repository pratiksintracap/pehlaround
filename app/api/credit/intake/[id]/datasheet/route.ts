import { formRoute } from "@/lib/credit/server/intake/http";
import { importDataSheet } from "@/lib/credit/server/intake/datasheet";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return formRoute(req, async (actor) => importDataSheet(actor, id, Buffer.from(await req.arrayBuffer())));
}
