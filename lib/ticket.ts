
/** The smallest allocation an office may request in a room: no floor, only the slider's smallest step (₹5 lakh).
 *  The site never states a minimum ticket; the size that fits is agreed with the desk. */
export const MIN_STEP_CR = 0.05;
export const minTicket = (): number => MIN_STEP_CR;
/** A room line that states a minimum ticket ("Family office ticket: ₹1 Cr minimum"): never shown to investors. */
export const NO_FLOOR = /\bticket\b|\bminimum\b/i;
/** Slider step for a minimum: ₹5 lakh steps below ₹1 crore. */
export const stepFor = (min: number, step: number) => (min < 1 ? Math.min(step, 0.05) : step);
