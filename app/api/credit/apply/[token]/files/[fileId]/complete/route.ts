import { applicantRoute } from "@/lib/credit/server/intake/http";
import { completeUpload } from "@/lib/credit/server/intake/partner";

export async function POST(req: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await params;
  return applicantRoute(req, token, (who) => completeUpload(who, fileId));
}
