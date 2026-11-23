import "server-only";
import { notFound } from "next/navigation";
import { ForbiddenError, NotFoundError, ValidationError } from "./actors";

export type ActionState = { error?: string; ok?: string; at?: number } | null;

/**
 * Runs a service call for a server action and turns expected errors into a message for the form.
 * The caller must run its auth guard (requireAdmin / requireLender) *before* this, outside the try.
 */
export async function run(fn: () => Promise<unknown>, ok = "Saved"): Promise<ActionState> {
  try {
    await fn();
    return { ok, at: Date.now() };
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message, at: Date.now() };
    if (e instanceof ForbiddenError) return { error: "Your account can't make this change.", at: Date.now() };
    if (e instanceof NotFoundError) notFound();
    // Anything unexpected (database or storage unreachable, a bug): log it and tell the person plainly,
    // rather than replacing the page with an error screen.
    console.error("[action] unexpected error", e);
    return { error: "We couldn't save this just now. Nothing was changed. Please try again in a few minutes.", at: Date.now() };
  }
}

export function str(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
}
