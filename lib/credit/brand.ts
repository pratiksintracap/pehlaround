/** Product name. Kept in one place so it is easy to change. */
export const BRAND_NAME = "Before the Bell";

/** Legal entity operating the platform (used in drafts and notices). Override with LEGAL_ENTITY_NAME. */
export function legalEntityName(): string {
  return process.env.LEGAL_ENTITY_NAME?.trim() || "SintraCap Advisors LLP";
}

/** The public website and its privacy notice. The version must match the notice on the site (apps/web/src/site.ts). */
export const PUBLIC_SITE = "https://beforethebell.in";
export const PRIVACY_NOTICE_VERSION = "2026-11-23";
