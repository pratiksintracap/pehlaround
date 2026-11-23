import { formRoute } from "@/lib/credit/server/intake/http";
import { submit } from "@/lib/credit/server/intake/partner";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return formRoute(req, (actor) => submit(actor, id));
}
