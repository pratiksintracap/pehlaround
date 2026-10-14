import "server-only";
import { getDb } from "@/lib/db";
import { settings } from "@/db/schema";
import { cachedPublic, PUBLIC_TAG } from "@/lib/cache";
import { revalidateTag } from "next/cache";
import { DEFAULT_PROMISES } from "@/lib/promises";

export type Settings = {
  requireApproval: boolean;   // offices see names and sign NDAs only after the desk approves them
  requirePan: boolean;        // rooms open only after the desk verifies the PAN
  announcement: string;       // banner across the top of the site; empty for none
  announcementLink: string;
  notifyDeskEmail: string;    // where desk alerts are emailed (if email is set up)
  onboardingEmails: boolean;  // send the onboarding email series to new offices
  promises: string;           // the desk's commitments shown on the office dashboard, one per line
  aiAnalyst: boolean;         // the AI analyst in the dashboard and rooms (needs ANTHROPIC_API_KEY)
  aiBudget: string;           // US$ a month the analyst may spend (estimated); 0 for no cap
  analystContacts: boolean;   // desk analysts may see family office people's email and phone
};
const DEFAULTS: Settings = { requireApproval: true, requirePan: false, announcement: "", announcementLink: "", notifyDeskEmail: process.env.ADMIN_EMAIL || "", onboardingEmails: true, promises: DEFAULT_PROMISES, aiAnalyst: true, aiBudget: "100", analystContacts: false };

const settingRows = cachedPublic(async () => { const db = await getDb(); return db.select().from(settings); }, "settings");
export async function getSettings(): Promise<Settings> {
  const rows = await settingRows();
  const s = { ...DEFAULTS } as Record<string, unknown>;
  for (const r of rows) {
    if (!(r.key in DEFAULTS)) continue;
    s[r.key] = typeof DEFAULTS[r.key as keyof Settings] === "boolean" ? r.value === "1" : r.value;
  }
  return s as Settings;
}

export async function saveSettings(v: Partial<Settings>) {
  const db = await getDb();
  for (const [k, val] of Object.entries(v)) {
    const value = typeof val === "boolean" ? (val ? "1" : "0") : String(val ?? "");
    await db.insert(settings).values({ key: k, value }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  }
  try { revalidateTag(PUBLIC_TAG); } catch { /* outside a request */ }
}
