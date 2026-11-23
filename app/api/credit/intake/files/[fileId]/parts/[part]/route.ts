import { formRoute } from "@/lib/credit/server/intake/http";
import { putPart } from "@/lib/credit/server/intake/partner";
import { PART_BYTES } from "@/lib/credit/server/intake/files";
import { ValidationError } from "@/lib/credit/server/actors";

export async function PUT(req: Request, { params }: { params: Promise<{ fileId: string; part: string }> }) {
  const { fileId, part } = await params;
  return formRoute(req, async (actor) => {
    const data = Buffer.from(await req.arrayBuffer());
    if (data.length > PART_BYTES) throw new ValidationError("Part too large");
    await putPart(actor, fileId, Number(part), data);
  });
}
