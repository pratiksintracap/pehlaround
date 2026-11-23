import { adminRoute } from "@/lib/credit/server/intake/http";
import { completeDealUpload } from "@/lib/credit/server/admin/direct-deals";

export async function POST(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  return adminRoute(req, (a) => completeDealUpload(a, fileId));
}
