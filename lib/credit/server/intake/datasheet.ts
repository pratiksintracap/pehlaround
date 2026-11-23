import "server-only";
import ExcelJS from "exceljs";
import { ValidationError } from "../actors";
import { answersFromDataSheet, mergeAnswers, type Cell, type Grid } from "@/lib/credit/intake/datasheet";
import { findQuestion, formFor, type Answers } from "@/lib/credit/intake/definition";
import { getMySubmission, saveAnswers, type Who } from "./partner";

const MAX_COLS = 60;
const MAX_ROWS = 600;

function cellValue(v: unknown): Cell {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return cellValue(o.result);
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if (typeof o.text === "string") return o.text;
    if ("error" in o) return null;
  }
  return null;
}

/** An .xlsx workbook as plain grids (first 600 rows × 60 columns of each sheet). */
export async function readWorkbook(data: Buffer): Promise<Grid> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data as unknown as ArrayBuffer);
  } catch {
    throw new ValidationError("That doesn't look like an Excel (.xlsx) workbook. Older .xls files need saving as .xlsx first.");
  }
  const g: Grid = {};
  wb.eachSheet((ws) => {
    const rows: Cell[][] = [];
    const n = Math.min(ws.rowCount, MAX_ROWS);
    for (let r = 1; r <= n; r++) {
      const row = ws.getRow(r);
      const out: Cell[] = [];
      for (let c = 1; c <= MAX_COLS; c++) out.push(cellValue(row.getCell(c).value));
      rows.push(out);
    }
    g[ws.name] = rows;
  });
  return g;
}

/** Fills the form's blank answers from an NBFC data workbook. Answers already given are kept. */
export async function importDataSheet(who: Who, submissionId: string, data: Buffer) {
  if (data.length > 4 * 1024 * 1024) throw new ValidationError("The workbook is larger than 4 MB. Remove pictures or extra tabs and try again.");
  const grid = await readWorkbook(data);
  const { submission } = await getMySubmission(who, submissionId);
  const form = formFor(submission);
  const res = answersFromDataSheet(grid, form);
  if (!res.filled.length) throw new ValidationError("Nothing in this workbook matched the form. It needs tabs like Company, Operations and Debt Profile.");
  const merged = mergeAnswers(submission.answers as Answers, res.answers);
  await saveAnswers(who, submissionId, merged);
  return {
    filled: res.filled.map((k) => findQuestion(form, k)?.label ?? k),
    notes: res.notes,
  };
}
