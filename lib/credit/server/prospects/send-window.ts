/**
 * Outreach can only be sent between 09:00 and 20:00 India time (the owner's rule: no outreach late at night).
 * Nothing is queued or sent automatically; outside these hours the Send button is off.
 */
const IST_OFFSET_MS = 5.5 * 3600 * 1000;
export const SEND_FROM_HOUR = 9;
export const SEND_UNTIL_HOUR = 20;

function istParts(d: Date) {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return { y: ist.getUTCFullYear(), m: ist.getUTCMonth(), day: ist.getUTCDate(), hour: ist.getUTCHours() };
}

export function inSendWindow(now: Date): boolean {
  const { hour } = istParts(now);
  return hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR;
}

/** The next 09:00 IST at or after `now` (today's if it's before 09:00, else tomorrow's). */
export function nextSendTime(now: Date): Date {
  const { y, m, day, hour } = istParts(now);
  const addDays = hour < SEND_FROM_HOUR ? 0 : 1;
  return new Date(Date.UTC(y, m, day + addDays, SEND_FROM_HOUR, 0, 0) - IST_OFFSET_MS);
}
