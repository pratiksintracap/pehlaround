// The IPO leg: nothing is shown before the price-band prospectus is filed; interest is taken until the issue closes;
// only a SEBI-registered AIF may choose the institutional categories.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ipoStage, ipoLive, categoriesFor, lakhToCr, fmtAmount } from "@/lib/ipo";

const at = (d: string) => new Date(d + "T06:00:00Z"); // 11:30 in India
test("an issue is invisible until the prospectus is filed, open until it closes, then closed until it lists", () => {
  assert.equal(ipoStage({}, at("2027-03-01")), "none");
  assert.equal(ipoStage({ drhp: "2026-12-01", sebi: "2027-02-01" }, at("2027-03-01")), "none");
  assert.equal(ipoStage({ rhp: "2027-03-05" }, at("2027-03-01")), "none", "a future date does not open it");
  const ipo = { rhp: "2027-03-05", opens: "2027-03-10", closes: "2027-03-12", listing: "2027-03-17" };
  assert.equal(ipoStage(ipo, at("2027-03-05")), "open");
  assert.equal(ipoStage(ipo, at("2027-03-12")), "open", "open through the closing day");
  assert.equal(ipoStage(ipo, at("2027-03-13")), "closed");
  assert.equal(ipoStage(ipo, at("2027-03-17")), "listed");
  assert.equal(ipoLive(ipo, at("2027-03-13")), true);
  assert.equal(ipoLive(ipo, at("2027-03-18")), false);
  assert.equal(ipoLive({}, at("2027-03-18")), false);
});
test("only an AIF chooses anchor or QIB; everyone else applies as non-institutional or individual", () => {
  assert.deepEqual(categoriesFor({ investorType: "fund", category: "AIF Category II" }), ["anchor", "qib"]);
  assert.deepEqual(categoriesFor({ investorType: "fund", category: "PMS" }), ["hni", "individual"]);
  assert.deepEqual(categoriesFor({ investorType: "family_office", category: "Private company" }), ["hni", "individual"]);
  assert.deepEqual(categoriesFor({ investorType: "individual" }), ["individual", "hni"]);
});
test("amounts are typed in lakh and kept in crore", () => {
  assert.equal(lakhToCr(2.5), 0.025); assert.equal(lakhToCr(250), 2.5);
  assert.equal(fmtAmount(0.025), "₹2.5 lakh"); assert.equal(fmtAmount("2.5"), "₹2.5 Cr");
});
