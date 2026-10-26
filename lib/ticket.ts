import type { RoomContent } from "./types";

/** The smallest allocation this office may request in a room. Individual investors (HNIs) get the desk's
 *  HNI minimum where it is below the room's own; HNI money fills the balance of a round once the anchor is in. */
export function minTicket(it: RoomContent["interest"], investorType: string | null | undefined, hniMinCr: string | number): number {
  const hni = Number(hniMinCr);
  if (investorType === "individual" && isFinite(hni) && hni > 0 && hni < it.min) return hni;
  return it.min;
}
/** Slider step for a minimum: ₹5 lakh steps below ₹1 crore. */
export const stepFor = (min: number, step: number) => (min < 1 ? Math.min(step, 0.05) : step);
