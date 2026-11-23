import "server-only";
import { eq } from "drizzle-orm";
import { documents } from "@/lib/credit/schema";
import { type AdminActor, NotFoundError } from "../actors";
import { logActivity } from "../activity";
import { asAdmin } from "./common";

export async function getDocumentForAdmin(actor: AdminActor, docId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(docId)) throw new NotFoundError();
  return asAdmin(actor, async (tx) => {
    const [doc] = await tx
      .select({ id: documents.id, filename: documents.filename, contentType: documents.contentType, storageKey: documents.storageKey })
      .from(documents)
      .where(eq(documents.id, docId));
    if (!doc) throw new NotFoundError();
    await logActivity(tx, actor, "document.viewed", "document", doc.id, { filename: doc.filename });
    return doc;
  });
}
