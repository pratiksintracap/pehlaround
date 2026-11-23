import { adminRoute } from "@/lib/credit/server/intake/http";
import { putDealPart } from "@/lib/credit/server/admin/direct-deals";
import { PART_BYTES } from "@/lib/credit/server/intake/files";
import { ValidationError } from "@/lib/credit/server/actors";

export async function PUT(req: Request, { params }: { params: Promise<{ fileId: string; part: string }> }) {
  const { fileId, part } = await params;
  return adminRoute(req, async (a) => {
    const data = Buffer.from(await req.arrayBuffer());
    if (data.length > PART_BYTES) throw new ValidationError("Part too large");
    await putDealPart(a, fileId, Number(part), data);
  });
}
