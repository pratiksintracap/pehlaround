import { applicantRoute } from "@/lib/credit/server/intake/http";
import { putPart } from "@/lib/credit/server/intake/partner";
import { PART_BYTES } from "@/lib/credit/server/intake/files";
import { ValidationError } from "@/lib/credit/server/actors";

export async function PUT(req: Request, { params }: { params: Promise<{ token: string; fileId: string; part: string }> }) {
  const { token, fileId, part } = await params;
  return applicantRoute(req, token, async (who) => {
    const data = Buffer.from(await req.arrayBuffer());
    if (data.length > PART_BYTES) throw new ValidationError("Part too large");
    await putPart(who, fileId, Number(part), data);
  });
}
