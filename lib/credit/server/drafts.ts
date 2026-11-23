import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { BRAND_NAME, legalEntityName } from "@/lib/credit/brand";
import { formatINR, formatRate } from "./decimal";
import { cycleLabel, cycleName } from "./cycles";

/*
 * Baseline drafts, generated from the raise as it stands. Anything the platform doesn't hold (tenor, repayment
 * schedule, fees, covenants) is left as a [●] placeholder for the parties to fill in: nothing commercial is assumed.
 * Neither document ever includes the borrower rate, the spread, or any other lender.
 */

export const DRAFT_VERSION = "baseline-1";

export type DraftRaise = {
  borrower: { name: string; cin: string | null; rbiRegistration: string | null; city: string | null; state: string | null };
  /** First day of the period's start month. */
  cycleStart: string;
  /** monthly | quarterly | yearly, fixed on the raise when it was created. */
  cycle: string;
  amount: string;
  filledAmount: string;
  lenderRate: string | null;
  instrument: string | null;
  segmentFunded: string | null;
  purpose: string | null;
  securityLevel: string | null;
  securityDescription: string | null;
  terms: string | null;
  termsVersion: number;
};

const TBD = "[●]";

const period = (r: DraftRaise) => cycleLabel(r.cycleStart, r.cycle);

function today() {
  return new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
}

const p = (text: string, opts: { bold?: boolean; italics?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
  new Paragraph({
    alignment: opts.align,
    spacing: { after: 120 },
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size })],
  });

const h = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: [new TextRun({ text })] });

function lines(text: string | null | undefined): string {
  return text && text.trim() ? text.trim() : TBD;
}

function termsTable(rows: [string, string][]) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "C9C9C2" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([k, v]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 32, type: WidthType.PERCENTAGE },
              borders: { top: border, bottom: border, left: border, right: border },
              children: [new Paragraph({ children: [new TextRun({ text: k, bold: true })] })],
            }),
            new TableCell({
              width: { size: 68, type: WidthType.PERCENTAGE },
              borders: { top: border, bottom: border, left: border, right: border },
              children: v.split("\n").map((line) => new Paragraph({ children: [new TextRun({ text: line })] })),
            }),
          ],
        }),
    ),
  });
}

function draftFooter(label: string) {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `${label} · Draft for discussion · Not an offer or commitment`, size: 16, color: "5B6472" })],
      }),
    ],
  });
}

function borrowerLine(b: DraftRaise["borrower"]) {
  const parts = [b.name];
  if (b.cin) parts.push(`CIN ${b.cin}`);
  if (b.rbiRegistration) parts.push(`RBI registration no. ${b.rbiRegistration}`);
  const place = [b.city, b.state].filter(Boolean).join(", ");
  if (place) parts.push(place);
  return parts.join(", ");
}

function commonTermsRows(r: DraftRaise): [string, string][] {
  return [
    ["Borrower", borrowerLine(r.borrower)],
    ["Instrument", r.instrument ?? TBD],
    ["Funding cycle", `${cycleName(r.cycle)}: ${period(r)}`],
    ["Purpose of funds", lines(r.purpose)],
    ["Segment funded", r.segmentFunded ?? TBD],
    ["Interest rate", r.lenderRate ? `${formatRate(r.lenderRate)} per annum, the same for every lender in this raise` : TBD],
    ["Interest payment frequency", TBD],
    ["Tenor", TBD],
    ["Repayment", TBD],
    ["Security", `${r.securityLevel ? r.securityLevel + ". " : ""}${lines(r.securityDescription)}\nThe same security package ranks for every lender in this raise (pari passu).`],
    ["Security cover", TBD],
    ["Fees and charges", TBD],
    ["Other terms", lines(r.terms)],
    ["Conditions precedent", "Satisfactory completion of each lender's own diligence; execution of the facility and security documents; board and shareholder approvals as required; KYC; " + TBD],
    ["Covenants", TBD],
    ["Events of default", "As set out in the definitive documents. " + TBD],
    ["Governing law and jurisdiction", `Laws of India; courts at ${TBD}`],
  ];
}

/** Term sheet / deal pack for the whole raise. Safe to send to any lender the raise is shared with. */
export async function buildTermSheet(r: DraftRaise): Promise<Buffer> {
  const doc = new Document({
    creator: BRAND_NAME,
    title: `Indicative term sheet: ${r.borrower.name}, ${period(r)}`,
    sections: [
      {
        footers: { default: draftFooter(`${BRAND_NAME} term sheet v${r.termsVersion}`) },
        children: [
          p(BRAND_NAME, { bold: true, size: 20 }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 120 }, children: [new TextRun({ text: "Indicative term sheet" })] }),
          p(`${r.borrower.name}: ${period(r)} raise (${r.cycle} cycle)`, { bold: true }),
          p(`Date: ${today()} · Terms version ${r.termsVersion}`, { size: 18 }),
          p(
            "This indicative term sheet summarises the proposed terms of the raise for discussion. It is not an offer, commitment or " +
              "agreement to lend. Any lending is subject to each lender's own diligence and credit approval and to definitive documentation. " +
              "Items marked [●] are to be agreed.",
            { italics: true, size: 18 },
          ),
          h("The raise"),
          termsTable([
            ["Amount of the raise", formatINR(r.amount)],
            ["Structure", "Sold down across multiple lenders at parity: the same security, terms and rate for every lender."],
            ["Amount filled so far", `${formatINR(r.filledAmount)} (lenders are not named)`],
          ]),
          h("Indicative terms"),
          termsTable(commonTermsRows(r)),
          h("Arranged by"),
          p(`${legalEntityName()} (${BRAND_NAME})`),
        ],
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

/** Sanction letter draft from one lender to the borrower, for the lender to issue on its own letterhead. */
export async function buildSanctionLetter(r: DraftRaise, lender: { name: string; amount: string }): Promise<Buffer> {
  const doc = new Document({
    creator: BRAND_NAME,
    title: `Draft sanction letter: ${lender.name} to ${r.borrower.name}`,
    sections: [
      {
        footers: { default: draftFooter(`${BRAND_NAME} sanction letter draft`) },
        children: [
          p("DRAFT: to be issued on the lender's letterhead", { bold: true, size: 18 }),
          p(lender.name, { bold: true }),
          p(`Date: ${TBD}`),
          p(`Ref: ${TBD}`),
          p("To,"),
          p(`The Board of Directors\n${borrowerLine(r.borrower)}`),
          new Paragraph({ spacing: { before: 240, after: 120 }, children: [new TextRun({ text: `Sub: Sanction of ${r.instrument ?? "facility"} of ${formatINR(lender.amount)}`, bold: true })] }),
          p("Dear Sirs / Madam,"),
          p(
            `With reference to your funding proposal for the ${period(r)} period (${r.cycle} cycle), we are pleased to inform you that we have ` +
              `sanctioned the facility described below, as our part of a raise of ${formatINR(r.amount)} arranged by ${legalEntityName()} ` +
              `(${BRAND_NAME}), on the terms and subject to the conditions set out below and in the definitive documents.`,
          ),
          termsTable([["Sanctioned amount", formatINR(lender.amount)], ...commonTermsRows(r)]),
          p(""),
          p(
            "Parity: the security and terms above are the same for every lender in this raise, and the security will be shared pari passu " +
              "among them.",
          ),
          p(`This sanction is valid until ${TBD}, after which it will lapse unless accepted and the conditions precedent are met.`),
          p("Please confirm your acceptance by signing and returning a copy of this letter."),
          p("Yours faithfully,"),
          p(`For ${lender.name}`),
          p("Authorised signatory"),
          p(""),
          p("Accepted", { bold: true }),
          p(`For ${r.borrower.name}`),
          p("Authorised signatory · Date: " + TBD),
        ],
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
