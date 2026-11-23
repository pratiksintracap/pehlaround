/**
 * Which form item a document most likely belongs to, from its file name and the folder (or ZIP) it came in.
 * Only a starting suggestion: the person uploading can change it before anything is sent.
 */
export function guessQuestionKey(filename: string, folder = ""): string {
  const name = filename.toLowerCase();
  const t = `${folder} ${filename}`.toLowerCase().replace(/[_]+/g, " ");
  const w = (re: string) => new RegExp(`(^|[^a-z])(${re})([^a-z]|$)`).test(t);
  if (/nbfc data|data ?sheet|portfolio|\baum\b|dpd|portfolio cut/.test(t) && /\.(xlsx?|csv)$/.test(name)) return "doc_portfolio";
  if (w("alm")) return "doc_alm";
  if (/bank|statement/.test(t)) return "doc_bank_statements";
  if (/moa|aoa|memorandum|articles of association/.test(t)) return "doc_moa";
  if (/sharehold/.test(t)) return "doc_shareholding";
  if (/certificate of registration|rbi.?reg/.test(t) || w("cor")) return "doc_cor";
  if (/provisional|quarter|half.?year|limited review|30\.06|30\.09|31\.12|\bq[1-4]\b|\bh1\b/.test(t)) return "doc_latest_financials";
  if (/audited|annual report|balance sheet|financial|profit and loss|p ?& ?l/.test(t)) return "doc_annual_reports";
  if (/kyc|aadhaa?r|adhar|gst|net ?worth|passport|voter|incorporation/.test(t) || w("pan|coi|din")) return "doc_kyc";
  if (/presentation|deck|pitch/.test(t)) return "doc_presentation";
  if (/credit policy|lending policy/.test(t)) return "doc_credit_policy";
  if (/collection|efficiency/.test(t) || w("cer")) return "doc_collections_mis";
  if (/static pool|vintage/.test(t)) return "doc_static_pool";
  return "doc_other";
}
