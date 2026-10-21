import { test } from "node:test";
import assert from "node:assert/strict";
import { investorRows, investorType, parseCsv } from "@/lib/csv";

test("parses quotes, commas and new lines inside fields", () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","line1\nline2"\r\n"he said ""hi""",z\n'), [["a", "b"], ["x, y", "line1\nline2"], ['he said "hi"', "z"]]);
});
test("maps common header names and skips rows without a name", () => {
  const { rows } = investorRows("Office Name,Contact Person,E-mail,Mobile,Type\nMehta FO,Raj,RAJ@X.COM,+91 1,Family office\n,,,,\nAlpha Fund,,a@b.in,,AIF");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { name: "Mehta FO", type: "Family office", contactName: "Raj", email: "raj@x.com", phone: "+91 1", city: "", ticket: "", website: "", notes: "" });
  assert.equal(investorType(rows[1].type), "fund");
});
test("a file without a name column is refused", () => {
  assert.deepEqual(investorRows("email\na@b.in").missing, ["name"]);
});
