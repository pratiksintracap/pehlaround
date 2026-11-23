import { applicantRoute } from "@/lib/credit/server/intake/http";
import { submit } from "@/lib/credit/server/intake/partner";
import { submissionIdFor } from "@/lib/credit/server/intake/public-forms";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return applicantRoute(req, token, async (who) => submit(who, await submissionIdFor(who)));
}
