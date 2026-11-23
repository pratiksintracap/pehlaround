import "server-only";

/*
 * Uploads to the borrower form go in parts so each request stays under the host's 4.5 MB request limit
 * (Vercel), while files up to 50 MB are still accepted. Every part except the last is exactly PART_BYTES.
 */
export const PART_BYTES = 4 * 1024 * 1024;
export const INTAKE_MAX_BYTES = 50 * 1024 * 1024;

const ALLOWED = ["pdf", "png", "jpg", "jpeg", "xlsx", "xls", "docx", "csv", "zip"];

export function allowedName(filename: string): boolean {
  return ALLOWED.includes(filename.toLowerCase().split(".").pop() ?? "");
}

export function safeFilename(name: string): string {
  return name.replace(/[^\w.\- ()]/g, "_").slice(0, 200) || "document";
}

export function partCountFor(size: number): number {
  return Math.max(1, Math.ceil(size / PART_BYTES));
}

/** The exact byte length part `index` (0-based) must have. */
export function expectedPartSize(size: number, index: number): number {
  const n = partCountFor(size);
  return index < n - 1 ? PART_BYTES : size - PART_BYTES * (n - 1);
}
