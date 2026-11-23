import { formRoute } from "@/lib/credit/server/intake/http";
import { completeUpload } from "@/lib/credit/server/intake/partner";

export async function POST(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  return formRoute(req, (actor) => completeUpload(actor, fileId));
}
