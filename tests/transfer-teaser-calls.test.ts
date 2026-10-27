// Transfer readiness, blind teasers, the call list and the IPO calendar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "@/lib/db";
import { deals, events, interests, kycFiles, ndas, offices, transferKyc, users } from "@/db/schema";
import { cleanDemat, readiness, readinessFor } from "@/lib/transfer";
import { teaser } from "@/lib/teaser";
import { callList } from "@/lib/call-list";
import { phase, calendar } from "@/lib/ipo-calendar";

test("demat ids are cleaned or refused", () => {
  assert.deepEqual(cleanDemat("nsdl", "in301234", "1234 5678"), { depository: "NSDL", dpId: "IN301234", clientId: "12345678" });
  assert.deepEqual(cleanDemat("CDSL", "12081600", "00123456"), { depository: "CDSL", dpId: "12081600", clientId: "00123456" });
  assert.deepEqual(cleanDemat("CDSL", "1208160000123456", ""), { depository: "CDSL", dpId: "12081600", clientId: "00123456" });
  assert.equal(cleanDemat("NSDL", "301234", "12345678"), null);
  assert.equal(cleanDemat("CDSL", "1208", "1"), null);
  assert.equal(cleanDemat("XYZ", "IN301234", "12345678"), null);
});

test("readiness counts the right items, and entities need the authority", () => {
  const f = (kind: string, status = "received") => ({ id: 1, kind, status, deskNote: status === "redo" ? "Blurred" : null, name: "x.pdf", size: 1, at: new Date(), checkedAt: null });
  const ind = readiness({ id: 1, pan: "ABCDE1234F", status: "pan_submitted", category: "Individual" }, { dpId: "IN301234", clientId: "12345678" } as never, [f("cml"), f("cheque", "redo")]);
  assert.equal(ind.total, 4); assert.equal(ind.done, 3); assert.equal(ind.ready, false);
  assert.equal(ind.items.find((i) => i.key === "cheque")?.note, "Blurred");
  const co = readiness({ id: 2, pan: null, status: "registered", category: "Private company" }, undefined, []);
  assert.equal(co.total, 5); assert.equal(co.done, 0);
  const all = readiness({ id: 3, pan: "ABCDE1234F", status: "verified", category: "Individual" }, { dpId: "IN301234", clientId: "12345678" } as never, [f("cml", "accepted"), f("cheque", "accepted")]);
  assert.equal(all.ready, true); assert.equal(all.checked, true);
});

test("a teaser never carries the company's name, and carries the sharer's code", () => {
  const t = teaser({ slug: "naval-defence-secondary", title: "Naval defence systems maker", category: "Pre-IPO secondary", headline: "Krasny builds sonar domes for the Navy", listingLabel: "2028", score: 8.4, company: "Krasny Defence" }, "abc23xyz");
  assert.ok(!/krasny defence/i.test(t.text));
  assert.ok(t.url.endsWith("/deals/naval-defence-secondary?ref=abc23xyz"));
  assert.ok(t.wa.startsWith("https://wa.me/?text="));
  assert.ok(/Desk Score 8\.4\/10/.test(t.text));
});

test("the call list ranks fresh allocation requests and repeat deck reads, and drops offices the desk can't see", async () => {
  const db = await getDb();
  const t = Date.now();
  const [o1, o2, o3] = await db.insert(offices).values([
    { name: `Hot FO ${t}`, approval: "approved" }, { name: `Warm FO ${t}`, approval: "approved" }, { name: `Private FO ${t}`, approval: "approved", origin: "desk", addedById: 999999 },
  ]).returning({ id: offices.id });
  const [u] = await db.insert(users).values({ email: `c${t}@x.in`, name: "C", passwordHash: "x", officeId: o1.id }).returning({ id: users.id });
  const [d] = await db.insert(deals).values({ slug: `call-test-${t}`, company: "Call Test Co", title: "t", category: "Pre-IPO primary", stage: "Room open", status: "s", headline: "h", listingLabel: "2028", room: {} as never }).returning({ id: deals.id });
  const now = new Date();
  await db.insert(interests).values({ dealId: d.id, officeId: o1.id, userId: u.id, amountCr: "2" });
  await db.insert(events).values([1, 2, 3].map(() => ({ kind: "deck_opened", officeId: o2.id, dealId: d.id, at: new Date(+now - 864e5) })));
  await db.insert(events).values([1, 2, 3].map(() => ({ kind: "deck_opened", officeId: o3.id, dealId: d.id, at: new Date(+now - 864e5) })));
  await db.insert(ndas).values({ dealId: d.id, officeId: o2.id, userId: u.id, signedAt: new Date(+now - 4 * 864e5), signerName: "C", signerEmail: "c@x.in", version: "t" });
  const rows = await callList({ id: 1, role: "analyst" }, { now });
  const mine = rows.filter((r) => [o1.id, o2.id, o3.id].includes(r.officeId));
  assert.equal(mine[0]?.officeId, o1.id);
  assert.ok(mine.some((r) => r.officeId === o2.id && r.reasons.some((x) => /deck 3 times/.test(x.text))));
  assert.ok(!mine.some((r) => r.officeId === o3.id), "a desk-added office is private to whoever added it");
  const admin = await callList({ id: 1, role: "admin" }, { now });
  assert.ok(admin.some((r) => r.officeId === o3.id));
});

test("readinessFor reads files per office and ignores replaced ones", async () => {
  const db = await getDb();
  const [o] = await db.insert(offices).values({ name: `KYC FO ${Date.now()}`, approval: "approved", category: "Individual", pan: "ABCDE1234F" }).returning({ id: offices.id });
  await db.insert(transferKyc).values({ officeId: o.id, depository: "NSDL", dpId: "IN301234", clientId: "12345678" });
  await db.insert(kycFiles).values([
    { officeId: o.id, kind: "cml", name: "old.pdf", mime: "application/pdf", size: 3, data: "AAA", status: "redo", replacedAt: new Date() },
    { officeId: o.id, kind: "cml", name: "new.pdf", mime: "application/pdf", size: 3, data: "AAA" },
  ]);
  const r = (await readinessFor([o.id])).get(o.id)!;
  assert.equal(r.items.find((i) => i.key === "cml")?.state, "done");
  assert.equal(r.done, 3);
});

test("IPO phases follow the dates", () => {
  const i = { name: "X", board: "SME" as const, open: "2026-10-27", close: "2026-10-29", listing: "2026-11-03" };
  assert.equal(phase(i, "2026-10-26"), "soon");
  assert.equal(phase(i, "2026-10-27"), "open");
  assert.equal(phase(i, "2026-10-30"), "closed");
  assert.equal(phase(i, "2026-11-03"), "listed");
  const c = calendar("2026-10-27");
  assert.ok(c.open.length > 0 && c.soon.length > 0);
});
