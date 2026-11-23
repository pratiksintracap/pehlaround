import "server-only";
import { NextResponse } from "next/server";
import { currentActor } from "../session";
import { NotFoundError, ValidationError, type PartnerActor } from "../actors";

/**
 * Route-handler helpers for the form's background requests (autosave, uploads). Cookies are sent with
 * same-site requests only (SameSite=Lax), and these handlers also require the request to come from this
 * origin, so another site can't post to them on a signed-in partner's behalf.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function partnerRoute(req: Request, fn: (actor: PartnerActor) => Promise<unknown>) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  if (actor.kind !== "partner") return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return NextResponse.json((await fn(actor)) ?? { ok: true });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("[intake] unexpected error", e);
    return NextResponse.json({ error: "Couldn't save just now. Please try again in a moment." }, { status: 500 });
  }
}

/** The form's own requests, from the partner whose company it is or from the platform team entering it for them. */
export async function formRoute(req: Request, fn: (actor: PartnerActor | import("../actors").AdminActor) => Promise<unknown>) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  if (actor.kind !== "partner" && actor.kind !== "admin") return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return NextResponse.json((await fn(actor)) ?? { ok: true });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("[intake] unexpected error", e);
    return NextResponse.json({ error: "Couldn't save just now. Please try again in a moment." }, { status: 500 });
  }
}

export async function adminRoute(req: Request, fn: (actor: import("../actors").AdminActor) => Promise<unknown>) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  if (actor.kind !== "admin") return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return NextResponse.json((await fn(actor)) ?? { ok: true });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("[deals] unexpected error", e);
    return NextResponse.json({ error: "Couldn't save just now. Please try again in a moment." }, { status: 500 });
  }
}

/** Public-form requests: the token in the path is the only credential. */
export async function applicantRoute(req: Request, token: string, fn: (who: import("./partner").Applicant) => Promise<unknown>) {
  if (req.method !== "GET" && !sameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const { applicantFor } = await import("./public");
  const who = applicantFor(token);
  if (!who) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  try {
    return NextResponse.json((await fn(who)) ?? { ok: true });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
    console.error("[apply] unexpected error", e);
    return NextResponse.json({ error: "Couldn't save just now. Please try again in a moment." }, { status: 500 });
  }
}
