"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, dealImages } from "@/db/schema";
import { requirePerm, log } from "@/lib/auth";
import { investorWhere } from "@/lib/deal-guard";
import { PUBLIC_TAG } from "@/lib/cache";

const MAX = 900_000; // base64 characters, about 650 KB of image; the browser shrinks the photo before sending
const MIME = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

const imgTag = (id: number) => `<img src="/api/deal-art/${id}" alt="" loading="lazy" decoding="async">`;

// Saves a card picture for a deal and points the card at it. Replaces any built-in illustration.
export async function uploadDealPicture(dealId: number, dataUrl: string): Promise<{ ok: true } | { error: string }> {
  const admin = await requirePerm("deals.edit");
  const m = MIME.exec(dataUrl || "");
  if (!m) return { error: "Use a JPG, PNG or WebP picture." };
  if (m[2].length > MAX) return { error: "The picture is too large even after shrinking. Try a smaller one." };
  const db = await getDb();
  const [cur] = await db.select({ id: deals.id, slug: deals.slug }).from(deals).where(investorWhere(eq(deals.id, dealId)));
  if (!cur) return { error: "Deal not found." };
  const [row] = await db.insert(dealImages).values({ dealId, mime: m[1], data: m[2], createdBy: admin.name }).returning({ id: dealImages.id });
  await db.update(deals).set({ art: imgTag(row.id), updatedAt: new Date() }).where(eq(deals.id, dealId));
  await log(admin, "Desk uploaded a new card picture", dealId);
  revalidateTag(PUBLIC_TAG);
  revalidatePath(`/admin/deals/${dealId}`); revalidatePath(`/deals/${cur.slug}`); revalidatePath("/");
  return { ok: true };
}
