import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dealImages } from "@/db/schema";

// Serves an uploaded card picture. Each upload gets a new id, so the bytes behind an id never change.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [img] = await db.select({ mime: dealImages.mime, data: dealImages.data }).from(dealImages).where(eq(dealImages.id, id));
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(img.data, "base64"), {
    headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
