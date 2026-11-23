/**
 * The borrower information form partners (aggregators) fill for each NBFC they introduce.
 *
 * One definition drives everything: the partner's form, which questions appear (showIf), what counts as
 * complete, server-side cleaning of answers, and the platform team's read-only view. Shared by client and
 * server, so it must stay free of server-only imports.
 *
 * Answers are stored as JSON keyed by question key. Files are stored separately, keyed by the question they
 * answer. A question that is hidden by an earlier answer is never required and never shown to the team.
 */

// ---------- types ----------

export type Cond =
  | { q: string; eq: string }
  | { q: string; in: string[] }
  | { q: string; has: string } // multi-select includes this option
  | { q: string; hasAny: string[] }
  | { q: string; answered: true }
  | { all: Cond[] }
  | { any: Cond[] };

export type Option = { value: string; label: string };

export type Column =
  | { key: string; label: string; type: "text" | "crore" | "percent" | "number" | "date" | "multiple"; width?: number }
  | { key: string; label: string; type: "select"; options: Option[]; width?: number };

export type Field =
  | { type: "text" | "textarea" | "email" | "phone" | "url" | "date" | "cin"; placeholder?: string }
  | { type: "crore" | "percent" | "number" | "lakh" | "multiple" }
  | { type: "select"; options: Option[] }
  | { type: "multi"; options: Option[] }
  | { type: "yesno" }
  | { type: "check" }
  /** Free rows, each with the same columns (e.g. one row per lender). */
  | { type: "table"; columns: Column[]; minRows?: number; maxRows?: number; addLabel?: string }
  /** One row per option chosen in a multi-select (e.g. one row per lending segment). */
  | { type: "perOption"; from: string; columns: Column[] }
  /** Fixed rows x fixed columns of numbers (e.g. metrics x financial years). */
  | { type: "grid"; rows: { key: string; label: string; unit: "crore" | "percent" | "number" }[]; cols: { key: string; label: string }[] }
  | { type: "file"; multiple?: boolean; hint?: string };

export type Question = {
  key: string;
  label: string;
  help?: string;
  required?: boolean;
  /** Required unless this other question is answered (e.g. a table OR an uploaded file). */
  orAnswered?: string;
  showIf?: Cond;
  field: Field;
};

export type Section = { key: string; title: string; intro?: string; showIf?: Cond; questions: Question[] };

export type FileRef = { id: string; questionKey: string; filename: string; sizeBytes: number };
export type Answers = Record<string, unknown>;

// ---------- option lists ----------

const o = (...labels: string[]): Option[] => labels.map((l) => ({ value: slug(l), label: l }));
function slug(s: string) {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export const STATES = o(
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
);

export const SEGMENTS: Option[] = [
  { value: "msme_lap", label: "MSME secured / loan against property" },
  { value: "msme_unsecured", label: "MSME unsecured / business loans" },
  { value: "mfi_jlg", label: "Microfinance – group (JLG)" },
  { value: "mfi_individual", label: "Microfinance – individual" },
  { value: "gold", label: "Gold loans" },
  { value: "cv_new", label: "Commercial vehicles – new" },
  { value: "cv_used", label: "Commercial vehicles – used" },
  { value: "two_wheeler", label: "Two-wheelers" },
  { value: "three_wheeler_ev", label: "Three-wheelers / e-rickshaws / EVs" },
  { value: "tractor", label: "Tractors and farm equipment" },
  { value: "housing", label: "Home loans / affordable housing" },
  { value: "personal", label: "Personal / consumer loans" },
  { value: "education", label: "Education loans" },
  { value: "supply_chain", label: "Supply chain / invoice finance" },
  { value: "agri", label: "Agri loans" },
  { value: "las", label: "Loans against securities" },
  { value: "other", label: "Other" },
];
const MFI = ["mfi_jlg", "mfi_individual"];
const VEHICLE = ["cv_new", "cv_used", "two_wheeler", "three_wheeler_ev", "tractor"];

const FACILITY = o(
  "Term loan", "Working capital / cash credit", "NCD", "Commercial paper", "Sub-debt", "Securitisation (PTC)",
  "Direct assignment", "Co-lending", "ECB", "Other",
);

// ---------- financial periods ----------

/** Indian financial years ending 31 March. Labels are computed from the date the form is opened. */
export function financialPeriods(now = new Date()): { key: string; label: string }[] {
  const y = now.getUTCFullYear();
  const lastEnd = now.getUTCMonth() >= 3 ? y : y - 1; // FY ending 31 Mar of this year once April has started
  const fy = (end: number) => `FY ${end - 1}-${String(end).slice(2)}`;
  return [
    { key: "latest", label: "Latest quarter" },
    { key: "fy0", label: fy(lastEnd) },
    { key: "fy1", label: fy(lastEnd - 1) },
    { key: "fy2", label: fy(lastEnd - 2) },
  ];
}

function lastMonths(n: number, now = new Date()): { key: string; label: string }[] {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ key: `m${i}`, label: d.toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }) });
  }
  return out;
}

// ---------- the form ----------

/** Who is filling the form: a signed-in partner, or someone from the public site (the company itself, or an agent). */
export type Audience = "partner" | "company" | "agent";

export function buildForm(now = new Date(), audience: Audience = "partner"): Section[] {
  return [
    {
      key: "company",
      title: "The company",
      questions: [
        { key: "legal_name", label: "Legal name", required: true, field: { type: "text" } },
        {
          key: "cin",
          label: "CIN",
          help: "21 characters, e.g. U65999MH2010PTC000000. We use it to match the company to RBI's register.",
          required: true,
          field: { type: "cin" },
        },
        { key: "rbi_cor", label: "RBI Certificate of Registration number", field: { type: "text", placeholder: "e.g. B-10.00123" } },
        { key: "incorporated_on", label: "Date of incorporation", field: { type: "date" } },
        { key: "city", label: "Head office city", required: true, field: { type: "text" } },
        { key: "state", label: "Head office state", required: true, field: { type: "select", options: STATES } },
        { key: "website", label: "Website", field: { type: "url", placeholder: "https://" } },
        {
          key: "nbfc_type",
          label: "NBFC type",
          required: true,
          field: {
            type: "select",
            options: [
              { value: "icc", label: "Investment and Credit Company (NBFC-ICC)" },
              { value: "mfi", label: "Microfinance (NBFC-MFI)" },
              { value: "hfc", label: "Housing Finance Company (HFC)" },
              { value: "factor", label: "Factoring (NBFC-Factor)" },
              { value: "ifc", label: "Infrastructure Finance Company (NBFC-IFC)" },
              { value: "other", label: "Other" },
            ],
          },
        },
        { key: "deposit_taking", label: "Does it accept public deposits?", required: true, field: { type: "yesno" } },
        {
          key: "layer",
          label: "RBI scale-based layer",
          field: { type: "select", options: [{ value: "base", label: "Base layer" }, { value: "middle", label: "Middle layer" }, { value: "unsure", label: "Not sure" }] },
        },
        {
          key: "listed",
          label: "Is any of its equity or debt listed?",
          required: true,
          field: { type: "select", options: [{ value: "no", label: "Not listed" }, { value: "equity", label: "Equity listed" }, { value: "debt", label: "Only debt (NCDs) listed" }] },
        },
        { key: "listed_detail", label: "Exchange and symbol, or ISINs", required: true, showIf: { q: "listed", in: ["equity", "debt"] }, field: { type: "text" } },
        { key: "group", label: "Is it part of a larger business group?", required: true, field: { type: "yesno" } },
        { key: "group_detail", label: "Group name, the parent's holding, and what else the group does", required: true, showIf: { q: "group", eq: "yes" }, field: { type: "textarea" } },
      ],
    },
    {
      key: "people",
      title: "People and ownership",
      questions: [
        { key: "contact_name", label: "Company's point person for this raise", help: "Usually the CFO or treasury head.", required: true, field: { type: "text" } },
        { key: "contact_role", label: "Their role", required: true, field: { type: "text" } },
        { key: "contact_email", label: "Their email", required: true, field: { type: "email" } },
        { key: "contact_phone", label: "Their phone", required: true, field: { type: "phone" } },
        {
          key: "management",
          label: "Promoters and key management",
          required: true,
          field: {
            type: "table",
            minRows: 1,
            maxRows: 12,
            addLabel: "Add person",
            columns: [
              { key: "name", label: "Name", type: "text", width: 3 },
              { key: "role", label: "Role", type: "text", width: 2 },
              { key: "years", label: "Years in lending", type: "number", width: 1 },
              { key: "holding", label: "Shareholding %", type: "percent", width: 1 },
            ],
          },
        },
        { key: "promoter_holding", label: "Promoter group's total shareholding (%)", required: true, field: { type: "percent" } },
        { key: "institutional", label: "Any institutional equity investors (PE, VC, family office)?", required: true, field: { type: "yesno" } },
        {
          key: "institutional_detail",
          label: "Institutional investors",
          required: true,
          showIf: { q: "institutional", eq: "yes" },
          field: {
            type: "table",
            minRows: 1,
            maxRows: 10,
            addLabel: "Add investor",
            columns: [
              { key: "investor", label: "Investor", type: "text", width: 3 },
              { key: "year", label: "Year invested", type: "number", width: 1 },
              { key: "amount", label: "Amount (₹ Cr)", type: "crore", width: 1 },
              { key: "holding", label: "Holding %", type: "percent", width: 1 },
            ],
          },
        },
        { key: "board_size", label: "Number of directors on the board", field: { type: "number" } },
        { key: "independent_directors", label: "Of which independent", field: { type: "number" } },
      ],
    },
    {
      key: "business",
      title: "Lending business",
      questions: [
        { key: "segments", label: "What does it lend against? Choose every product line", required: true, field: { type: "multi", options: SEGMENTS } },
        { key: "segment_other", label: "Describe the other product line", required: true, showIf: { q: "segments", has: "other" }, field: { type: "text" } },
        {
          key: "segment_mix",
          label: "For each product line",
          help: "Share of AUM should add up to about 100%. Yield is the rate charged to customers.",
          required: true,
          showIf: { q: "segments", answered: true },
          field: {
            type: "perOption",
            from: "segments",
            columns: [
              { key: "share", label: "Share of AUM %", type: "percent" },
              { key: "ticket", label: "Avg ticket (₹ lakh)", type: "number" },
              { key: "tenor", label: "Avg tenor (months)", type: "number" },
              { key: "yield", label: "Yield % p.a.", type: "text" },
              { key: "secured", label: "Secured?", type: "select", options: o("Yes", "Partly", "No") },
            ],
          },
        },
        { key: "states_active", label: "States it lends in", required: true, field: { type: "multi", options: STATES } },
        { key: "top_state_share", label: "Share of AUM in its largest state (%)", required: true, field: { type: "percent" } },
        { key: "branches", label: "Number of branches", required: true, field: { type: "number" } },
        { key: "active_loans", label: "Active loan accounts", required: true, field: { type: "number" } },
        { key: "employees", label: "Employees", field: { type: "number" } },
        {
          key: "origination",
          label: "How are loans sourced?",
          required: true,
          field: { type: "multi", options: o("Own branches and staff", "DSAs / connectors", "Fintech or digital partners", "Co-lending with banks or NBFCs", "Other") },
        },
        {
          key: "partner_sourcing",
          label: "Share of AUM sourced through partners or co-lending (%), and the main partners",
          required: true,
          showIf: { q: "origination", hasAny: ["fintech_or_digital_partners", "co_lending_with_banks_or_nbfcs"] },
          field: { type: "textarea" },
        },
        {
          key: "collections",
          label: "How are repayments collected?",
          required: true,
          field: { type: "multi", options: o("Cash at branch or doorstep", "NACH / e-mandate", "UPI or other digital", "Post-dated cheques", "Other") },
        },
        { key: "cash_share", label: "Share of collections in cash (%)", required: true, showIf: { q: "collections", has: "cash_at_branch_or_doorstep" }, field: { type: "percent" } },
        { key: "lms", label: "Loan management software used", field: { type: "text" } },
        {
          key: "bureau",
          label: "Does it report to the credit bureaus?",
          required: true,
          field: { type: "select", options: [{ value: "all", label: "All four (CIBIL, Experian, Equifax, CRIF)" }, { value: "some", label: "Some of them" }, { value: "none", label: "None" }] },
        },
      ],
    },
    {
      key: "mfi",
      title: "Microfinance",
      intro: "Shown because microfinance is one of the product lines.",
      showIf: { q: "segments", hasAny: MFI },
      questions: [
        { key: "mfi_qualifying", label: "Qualifying microfinance assets as % of total assets", required: true, field: { type: "percent" } },
        {
          key: "mfi_income_check",
          label: "Is every loan checked against RBI's cap (repayments within 50% of household income)?",
          required: true,
          field: { type: "yesno" },
        },
        { key: "mfi_lenders_per_borrower", label: "Average number of lenders per borrower (from bureau data)", field: { type: "number" } },
        { key: "mfi_sro", label: "Member of an SRO", field: { type: "select", options: o("MFIN", "Sa-Dhan", "Both", "Neither") } },
      ],
    },
    {
      key: "gold",
      title: "Gold loans",
      intro: "Shown because gold loans are one of the product lines.",
      showIf: { q: "segments", has: "gold" },
      questions: [
        { key: "gold_ltv_avg", label: "Average loan-to-value at disbursal (%)", required: true, field: { type: "percent" } },
        { key: "gold_auctions", label: "Auctions in the last 12 months (₹ Cr)", required: true, field: { type: "crore" } },
        { key: "gold_storage", label: "Where the gold is kept, who audits it, and how it's insured", required: true, field: { type: "textarea" } },
      ],
    },
    {
      key: "vehicle",
      title: "Vehicle loans",
      intro: "Shown because vehicle loans are one of the product lines.",
      showIf: { q: "segments", hasAny: VEHICLE },
      questions: [
        { key: "veh_used_share", label: "Used vehicles as % of the vehicle book", required: true, field: { type: "percent" } },
        { key: "veh_ltv", label: "Average loan-to-value (%)", required: true, field: { type: "percent" } },
        { key: "veh_repos", label: "Repossessions in the last 12 months (number)", field: { type: "number" } },
      ],
    },
    {
      key: "secured_property",
      title: "Property-backed loans",
      intro: "Shown because home loans or loans against property are one of the product lines.",
      showIf: { q: "segments", hasAny: ["housing", "msme_lap"] },
      questions: [
        { key: "prop_ltv", label: "Average loan-to-value (%)", required: true, field: { type: "percent" } },
        { key: "prop_self_employed", label: "Self-employed borrowers as % of this book", field: { type: "percent" } },
        { key: "prop_title", label: "How is title checked (in-house, empanelled lawyers, both)?", field: { type: "text" } },
      ],
    },
    {
      key: "unsecured",
      title: "Unsecured loans",
      intro: "Shown because unsecured lending is one of the product lines.",
      showIf: { q: "segments", hasAny: ["msme_unsecured", "personal", "education"] },
      questions: [
        { key: "unsec_filters", label: "Credit filters used (minimum bureau score, income checks, etc.)", required: true, field: { type: "textarea" } },
      ],
    },
    {
      key: "supply_chain",
      title: "Supply chain finance",
      intro: "Shown because supply chain finance is one of the product lines.",
      showIf: { q: "segments", has: "supply_chain" },
      questions: [
        { key: "sc_anchors", label: "Main anchors, and the largest anchor's share of this book (%)", required: true, field: { type: "textarea" } },
      ],
    },
    {
      key: "financials",
      title: "Financials",
      intro: "All amounts in ₹ crore. Leave a cell blank if it isn't available yet.",
      questions: [
        {
          key: "fin",
          label: "Key numbers",
          required: true,
          help: "Off-book AUM is what has been securitised, assigned or co-lent and is not on the balance sheet.",
          field: {
            type: "grid",
            cols: financialPeriods(now),
            rows: [
              { key: "aum_on", label: "AUM on book", unit: "crore" },
              { key: "aum_off", label: "AUM off book", unit: "crore" },
              { key: "disbursed", label: "Disbursed in the period", unit: "crore" },
              { key: "net_worth", label: "Net worth", unit: "crore" },
              { key: "borrowings", label: "Total borrowings", unit: "crore" },
              { key: "income", label: "Total income", unit: "crore" },
              { key: "pat", label: "Profit after tax", unit: "crore" },
              { key: "crar", label: "CRAR %", unit: "percent" },
              { key: "gnpa", label: "Gross NPA %", unit: "percent" },
              { key: "nnpa", label: "Net NPA %", unit: "percent" },
            ],
          },
        },
        { key: "latest_period_end", label: "The latest quarter ended on", required: true, field: { type: "date" } },
        {
          key: "dpd",
          label: "Portfolio by days past due, latest month (% of AUM)",
          required: true,
          field: {
            type: "grid",
            cols: [{ key: "pct", label: "% of AUM" }],
            rows: [
              { key: "current", label: "Current", unit: "percent" },
              { key: "d1_30", label: "1–30 days", unit: "percent" },
              { key: "d31_60", label: "31–60 days", unit: "percent" },
              { key: "d61_90", label: "61–90 days", unit: "percent" },
              { key: "d90", label: "90+ days", unit: "percent" },
            ],
          },
        },
        {
          key: "collection_eff",
          label: "Collection efficiency, last 6 months (%)",
          help: "Amount collected ÷ amount due for the month, excluding prepayments and overdue recoveries.",
          required: true,
          field: { type: "grid", cols: [{ key: "pct", label: "%" }], rows: lastMonths(6, now).map((m) => ({ ...m, unit: "percent" as const })) },
        },
        { key: "writeoffs", label: "Write-offs in the last financial year (₹ Cr)", required: true, field: { type: "crore" } },
        { key: "restructured", label: "Restructured loans as % of AUM", field: { type: "percent" } },
        { key: "liquidity", label: "Cash and liquid investments today (₹ Cr)", required: true, field: { type: "crore" } },
        { key: "undrawn", label: "Sanctioned but undrawn lines today (₹ Cr)", field: { type: "crore" } },
        { key: "alm_gap", label: "Any negative cumulative mismatch in the ALM buckets up to one year?", required: true, field: { type: "yesno" } },
        { key: "alm_gap_detail", label: "Which buckets, how large, and how it's being covered", required: true, showIf: { q: "alm_gap", eq: "yes" }, field: { type: "textarea" } },
      ],
    },
    {
      key: "borrowings",
      title: "Borrowings and rating",
      questions: [
        {
          key: "lenders",
          label: "Current lenders",
          help: "One row per facility. Or upload the company's borrowing profile below instead.",
          required: true,
          orAnswered: "borrowing_profile",
          field: {
            type: "table",
            maxRows: 40,
            addLabel: "Add facility",
            columns: [
              { key: "lender", label: "Lender", type: "text", width: 3 },
              { key: "facility", label: "Facility", type: "select", options: FACILITY, width: 2 },
              { key: "sanctioned", label: "Sanctioned (₹ Cr)", type: "crore" },
              { key: "outstanding", label: "Outstanding (₹ Cr)", type: "crore" },
              { key: "rate", label: "Rate %", type: "percent" },
              { key: "cover", label: "Security cover (x)", type: "multiple" },
              { key: "maturity", label: "Final maturity", type: "date", width: 2 },
            ],
          },
        },
        { key: "borrowing_profile", label: "Borrowing profile (instead of the table)", field: { type: "file", hint: "Excel or PDF, lender-wise" } },
        { key: "rated", label: "Does the company have a credit rating?", required: true, field: { type: "yesno" } },
        {
          key: "rating_agency",
          label: "Rating agency",
          required: true,
          showIf: { q: "rated", eq: "yes" },
          field: { type: "select", options: o("CRISIL", "ICRA", "CARE", "India Ratings", "Acuité", "Infomerics", "Brickwork", "Other") },
        },
        { key: "rating", label: "Rating and outlook", required: true, showIf: { q: "rated", eq: "yes" }, field: { type: "text", placeholder: "e.g. BBB- (Stable)" } },
        { key: "rating_date", label: "Date of the latest rating action", showIf: { q: "rated", eq: "yes" }, field: { type: "date" } },
        { key: "rating_letter", label: "Rating letter and rationale", required: true, showIf: { q: "rated", eq: "yes" }, field: { type: "file", multiple: true } },
        { key: "delays", label: "Any delay, default or restructuring on its own borrowings in the last 3 years?", required: true, field: { type: "yesno" } },
        { key: "delays_detail", label: "What happened, when, and how it was resolved", required: true, showIf: { q: "delays", eq: "yes" }, field: { type: "textarea" } },
        { key: "covenants", label: "Any covenant breach or waiver in the last 2 years?", required: true, field: { type: "yesno" } },
        { key: "covenants_detail", label: "Which covenant, with which lender, and the outcome", required: true, showIf: { q: "covenants", eq: "yes" }, field: { type: "textarea" } },
      ],
    },
    {
      key: "ask",
      title: "Funding needed",
      questions: [
        { key: "amount_12m", label: "Total funding sought over the next 12 months (₹ Cr)", required: true, field: { type: "crore" } },
        {
          key: "cycle",
          label: "How often would it draw down?",
          required: true,
          field: { type: "select", options: [{ value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "yearly", label: "Yearly" }, { value: "unsure", label: "Not decided yet" }] },
        },
        { key: "per_drawdown", label: "Amount per drawdown (₹ Cr)", required: true, field: { type: "crore" } },
        { key: "first_drawdown", label: "First drawdown needed by", field: { type: "date" } },
        {
          key: "instrument",
          label: "Instrument",
          required: true,
          field: { type: "select", options: [{ value: "term_loan", label: "Term loan" }, { value: "ncd", label: "NCDs" }, { value: "either", label: "Open to either" }] },
        },
        { key: "tenor", label: "Tenor sought", required: true, field: { type: "select", options: o("12 months", "18 months", "24 months", "36 months", "48 months or more") } },
        { key: "rate_from", label: "Expected interest rate, from (% p.a.)", required: true, field: { type: "percent" } },
        { key: "rate_to", label: "Expected interest rate, to (% p.a.)", required: true, field: { type: "percent" } },
        {
          key: "security",
          label: "Security offered",
          required: true,
          field: { type: "multi", options: o("Hypothecation of loan receivables", "Cash collateral / FD lien", "Promoter personal guarantee", "Corporate guarantee", "Other") },
        },
        {
          key: "cover",
          label: "Receivables cover offered",
          required: true,
          showIf: { q: "security", has: "hypothecation_of_loan_receivables" },
          field: { type: "select", options: o("1.00x", "1.10x", "1.15x", "1.20x", "1.25x", "Higher than 1.25x") },
        },
        { key: "cash_collateral", label: "Cash collateral offered (% of the loan)", required: true, showIf: { q: "security", has: "cash_collateral_fd_lien" }, field: { type: "percent" } },
        { key: "security_other", label: "Describe the other security", required: true, showIf: { q: "security", has: "other" }, field: { type: "text" } },
        { key: "end_use", label: "Which product lines the money will be lent to", required: true, field: { type: "multi", options: SEGMENTS } },
        { key: "shopped", label: "Has this requirement been shared with other lenders or arrangers?", required: true, field: { type: "yesno" } },
        { key: "shopped_detail", label: "With whom, and where it stands", required: true, showIf: { q: "shopped", eq: "yes" }, field: { type: "textarea" } },
      ],
    },
    {
      key: "compliance",
      title: "Governance and compliance",
      questions: [
        { key: "auditor", label: "Statutory auditor", required: true, field: { type: "text" } },
        { key: "audit_flags", label: "Any qualification or emphasis of matter in the last audit report?", required: true, field: { type: "yesno" } },
        { key: "audit_flags_detail", label: "What the auditor said", required: true, showIf: { q: "audit_flags", eq: "yes" }, field: { type: "textarea" } },
        {
          key: "rbi_action",
          label: "Any RBI penalty, show-cause notice or business restriction in the last 3 years?",
          help: "Please don't upload RBI inspection reports: they are confidential between the company and RBI. A short summary is enough.",
          required: true,
          field: { type: "yesno" },
        },
        { key: "rbi_action_detail", label: "What it was about and its status", required: true, showIf: { q: "rbi_action", eq: "yes" }, field: { type: "textarea" } },
        { key: "litigation", label: "Any material litigation against the company or its promoters?", required: true, field: { type: "yesno" } },
        { key: "litigation_detail", label: "Brief details", required: true, showIf: { q: "litigation", eq: "yes" }, field: { type: "textarea" } },
        {
          key: "defaulter",
          label: "Is any promoter or director on a wilful-defaulter or suit-filed list, or connected to a company that defaulted?",
          required: true,
          field: { type: "yesno" },
        },
        { key: "defaulter_detail", label: "Brief details", required: true, showIf: { q: "defaulter", eq: "yes" }, field: { type: "textarea" } },
        { key: "related_party", label: "Loans to related parties or group companies, as % of AUM", field: { type: "percent" } },
      ],
    },
    {
      key: "documents",
      title: "Documents",
      intro: "PDF, Excel, Word, CSV, images or ZIP, up to 50 MB each. You can add several files to each item.",
      questions: [
        { key: "doc_annual_reports", label: "Audited financial statements, last 3 years", required: true, field: { type: "file", multiple: true } },
        { key: "doc_latest_financials", label: "Latest quarterly or half-yearly financials", help: "Provisional is fine.", required: true, field: { type: "file", multiple: true } },
        {
          key: "doc_portfolio",
          label: "Portfolio cut / AUM summary",
          help: "Ideally Excel: AUM by product, state, ticket size and days-past-due bucket.",
          required: true,
          field: { type: "file", multiple: true },
        },
        { key: "doc_alm", label: "Latest ALM statement (as filed with RBI)", required: true, field: { type: "file", multiple: true } },
        { key: "doc_shareholding", label: "Shareholding pattern", required: true, field: { type: "file", multiple: true } },
        { key: "doc_cor", label: "RBI Certificate of Registration", required: true, field: { type: "file" } },
        { key: "doc_presentation", label: "Company presentation", field: { type: "file", multiple: true } },
        { key: "doc_moa", label: "MoA and AoA", field: { type: "file", multiple: true } },
        { key: "doc_credit_policy", label: "Credit policy", field: { type: "file", multiple: true } },
        { key: "doc_collections_mis", label: "Collection efficiency MIS, last 12 months", field: { type: "file", multiple: true } },
        { key: "doc_static_pool", label: "Static pool / vintage analysis", field: { type: "file", multiple: true } },
        { key: "doc_bank_statements", label: "Bank statements, last 12 months", field: { type: "file", multiple: true } },
        { key: "doc_kyc", label: "KYC: company (PAN, GST, incorporation) and directors", field: { type: "file", multiple: true } },
        { key: "doc_other", label: "Anything else", field: { type: "file", multiple: true } },
      ],
    },
    audience === "company"
      ? {
          key: "declaration",
          title: "Anything else, and authorisation",
          questions: [
            { key: "partner_notes", label: "Anything else we should know", field: { type: "textarea" } },
            {
              key: "authorised",
              label: "I am authorised by the company to share this information and these documents with Before the Bell to arrange funding.",
              required: true,
              field: { type: "check" },
            },
            { key: "authorised_by", label: "Your name and designation", required: true, field: { type: "text" } },
            { key: "accurate", label: "To the best of my knowledge, the information given is accurate.", required: true, field: { type: "check" } },
          ],
        }
      : {
          key: "declaration",
          title: "Your notes and authorisation",
          questions: [
            {
              key: "relationship",
              label: "Your relationship with the company",
              required: true,
              field: { type: "select", options: [{ value: "mandate", label: "The company has mandated me" }, { value: "introduction", label: "Introduction only" }, { value: "other", label: "Other" }] },
            },
            { key: "partner_notes", label: "Your view: why this company, and anything we should know", field: { type: "textarea" } },
            {
              key: "authorised",
              label: "The company has authorised me to share this information and these documents with Before the Bell to arrange funding.",
              required: true,
              field: { type: "check" },
            },
            { key: "authorised_by", label: "Who at the company authorised it (name and designation)", required: true, field: { type: "text" } },
            { key: "accurate", label: "To the best of my knowledge, the information given is accurate.", required: true, field: { type: "check" } },
          ],
        },
  ];
}

// ---------- logic ----------

const asArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function test(c: Cond | undefined, a: Answers): boolean {
  if (!c) return true;
  if ("all" in c) return c.all.every((x) => test(x, a));
  if ("any" in c) return c.any.some((x) => test(x, a));
  const v = a[c.q];
  if ("eq" in c) return v === c.eq;
  if ("in" in c) return typeof v === "string" && c.in.includes(v);
  if ("has" in c) return asArray(v).includes(c.has);
  if ("hasAny" in c) return asArray(v).some((x) => c.hasAny.includes(x));
  return isAnswered(v);
}

export function visibleSections(form: Section[], a: Answers) {
  return form
    .filter((s) => test(s.showIf, a))
    .map((s) => ({ ...s, questions: s.questions.filter((q) => test(q.showIf, a)) }));
}

export function isAnswered(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.some((r) => (typeof r === "string" ? r.trim() !== "" : isAnswered(r)));
  if (typeof v === "object") return Object.values(v as object).some((x) => isAnswered(x));
  return true;
}

export type Missing = { section: string; key: string; label: string };

/** Required, visible questions with no answer (files: no file uploaded). */
export function missingItems(form: Section[], a: Answers, files: Pick<FileRef, "questionKey">[]): Missing[] {
  const hasFile = (k: string) => files.some((f) => f.questionKey === k);
  const answered = (q: Question) => (q.field.type === "file" ? hasFile(q.key) : isAnswered(a[q.key]));
  const out: Missing[] = [];
  for (const s of visibleSections(form, a)) {
    for (const q of s.questions) {
      if (!q.required || answered(q)) continue;
      if (q.orAnswered) {
        const alt = s.questions.find((x) => x.key === q.orAnswered) ?? findQuestion(form, q.orAnswered);
        if (alt && answered(alt)) continue;
      }
      out.push({ section: s.title, key: q.key, label: q.label });
    }
  }
  return out;
}

export function requiredCount(form: Section[], a: Answers): number {
  return visibleSections(form, a).reduce((n, s) => n + s.questions.filter((q) => q.required).length, 0);
}

export function findQuestion(form: Section[], key: string): Question | undefined {
  for (const s of form) for (const q of s.questions) if (q.key === key) return q;
  return undefined;
}

/** Latest known AUM (on-book + off-book) in ₹ Cr, for the size check against the target band. */
export function reportedAum(a: Answers): number | null {
  const fin = (a.fin ?? {}) as Record<string, Record<string, string>>;
  for (const col of ["latest", "fy0"]) {
    const on = Number(fin.aum_on?.[col] ?? "");
    const off = Number(fin.aum_off?.[col] ?? "");
    if (fin.aum_on?.[col]) return (Number.isFinite(on) ? on : 0) + (Number.isFinite(off) && fin.aum_off?.[col] ? off : 0);
  }
  return null;
}

export const CIN_RE = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;

// ---------- cleaning answers (server side, also used by tests) ----------

export class AnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnswerError";
  }
}

const NUM_RE = /^-?\d{1,12}(\.\d{1,4})?$/;

function cleanNumber(v: unknown, label: string, kind: "crore" | "percent" | "number" | "lakh" | "multiple"): string | undefined {
  if (v == null) return undefined;
  const s = String(v).replace(/,/g, "").replace(/%$/, "").replace(/x$/i, "").trim();
  if (s === "") return undefined;
  if (!NUM_RE.test(s)) throw new AnswerError(`${label}: enter a number`);
  if (kind === "percent" && (Number(s) < -100 || Number(s) > 1000)) throw new AnswerError(`${label}: enter a percentage`);
  return s;
}

function cleanText(v: unknown, max: number): string | undefined {
  if (v == null) return undefined;
  const s = String(v).replace(/\u0000/g, "").trim();
  return s === "" ? undefined : s.slice(0, max);
}

function cleanCell(col: Column, v: unknown, label: string): string | undefined {
  switch (col.type) {
    case "select":
      return typeof v === "string" && col.options.some((x) => x.value === v) ? v : undefined;
    case "crore":
    case "percent":
    case "number":
    case "multiple":
      return cleanNumber(v, `${label} – ${col.label}`, col.type);
    case "date":
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
    default:
      return cleanText(v, 300);
  }
}

function cleanRow(cols: Column[], row: unknown, label: string): Record<string, string> | undefined {
  if (!row || typeof row !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const c of cols) {
    const v = cleanCell(c, (row as Record<string, unknown>)[c.key], label);
    if (v !== undefined) out[c.key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Keeps only known questions, with values of the right shape. Hidden questions are kept (so going back and
 * forth doesn't lose work) but never count towards completeness or show to the platform team.
 */
export function cleanAnswers(form: Section[], raw: unknown): Answers {
  if (!raw || typeof raw !== "object") return {};
  const input = raw as Record<string, unknown>;
  const out: Answers = {};
  for (const s of form) {
    for (const q of s.questions) {
      const v = input[q.key];
      if (v === undefined) continue;
      const f = q.field;
      let c: unknown;
      switch (f.type) {
        case "text":
        case "email":
        case "phone":
        case "url":
          c = cleanText(v, 300);
          break;
        case "cin":
          c = cleanText(v, 30)?.toUpperCase().replace(/\s+/g, "");
          break;
        case "textarea":
          c = cleanText(v, 4000);
          break;
        case "date":
          c = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
          break;
        case "crore":
        case "percent":
        case "number":
        case "lakh":
        case "multiple":
          c = cleanNumber(v, q.label, f.type);
          break;
        case "select":
          c = typeof v === "string" && f.options.some((x) => x.value === v) ? v : undefined;
          break;
        case "multi": {
          const vals = asArray(v).filter((x) => f.options.some((op) => op.value === x));
          c = vals.length ? [...new Set(vals)] : undefined;
          break;
        }
        case "yesno":
          c = v === "yes" || v === "no" ? v : undefined;
          break;
        case "check":
          c = v === true ? true : undefined;
          break;
        case "table": {
          const rows = (Array.isArray(v) ? v : []).slice(0, f.maxRows ?? 50).map((r) => cleanRow(f.columns, r, q.label)).filter(Boolean);
          c = rows.length ? rows : undefined;
          break;
        }
        case "perOption": {
          const src = findQuestion(form, f.from);
          const allowed = src && src.field.type === "multi" ? src.field.options.map((x) => x.value) : [];
          const obj: Record<string, Record<string, string>> = {};
          if (v && typeof v === "object") {
            for (const [k, r] of Object.entries(v as object)) {
              if (!allowed.includes(k)) continue;
              const row = cleanRow(f.columns, r, q.label);
              if (row) obj[k] = row;
            }
          }
          c = Object.keys(obj).length ? obj : undefined;
          break;
        }
        case "grid": {
          const obj: Record<string, Record<string, string>> = {};
          if (v && typeof v === "object") {
            for (const r of f.rows) {
              const rv = (v as Record<string, unknown>)[r.key];
              if (!rv || typeof rv !== "object") continue;
              const cells: Record<string, string> = {};
              for (const col of f.cols) {
                const x = cleanNumber((rv as Record<string, unknown>)[col.key], `${q.label} – ${r.label}`, r.unit);
                if (x !== undefined) cells[col.key] = x;
              }
              if (Object.keys(cells).length) obj[r.key] = cells;
            }
          }
          c = Object.keys(obj).length ? obj : undefined;
          break;
        }
        case "file":
          c = undefined;
          break;
      }
      if (c !== undefined) out[q.key] = c;
    }
  }
  return out;
}

/**
 * The few answers a form needs before it can be sent. Everything else marked important can follow later: the
 * applicant can come back to the form, and the team can fill gaps on a call.
 */
export const ESSENTIAL = ["legal_name", "contact_name", "contact_phone", "amount_12m", "authorised"] as const;

const SHORT_LABEL: Record<string, string> = { authorised: "Confirmation that you're authorised to share this information" };

export function isEssential(key: string): boolean {
  return (ESSENTIAL as readonly string[]).includes(key);
}

export function essentialMissing(form: Section[], a: Answers): Missing[] {
  const out: Missing[] = [];
  for (const s of form) for (const q of s.questions) if (isEssential(q.key) && !isAnswered(a[q.key])) out.push({ section: s.title, key: q.key, label: SHORT_LABEL[q.key] ?? q.label });
  return out;
}

/** What blocks sending: missing essentials and answers in the wrong format. Other gaps don't. */
export function submitProblems(form: Section[], a: Answers, _files: Pick<FileRef, "questionKey">[]): string[] {
  void _files;
  const p = essentialMissing(form, a).map((m) => `${m.section}: ${m.label}`);
  if (typeof a.cin === "string" && !CIN_RE.test(a.cin)) p.unshift("The company: CIN doesn't look right (21 characters, e.g. U65999MH2010PTC000000)");
  if (typeof a.contact_email === "string" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.contact_email)) p.unshift("People and ownership: the point person's email doesn't look right");
  return p;
}

/** The form as it was for a stored submission (its start date fixes the financial-year labels). */
export function formFor(s: { createdAt: Date; source?: string | null; submitterRole?: string | null }): Section[] {
  return buildForm(s.createdAt, s.source === "public" && s.submitterRole === "company" ? "company" : s.source === "public" ? "agent" : "partner");
}

/** Answers the form can take from RBI's register for a company (state, NBFC type, layer, registration number). */
export function answersFromRegistry(r: { state: string | null; type: string | null; layer: string | null; rbiRegNo: string | null }): Answers {
  const out: Answers = {};
  const state = r.state ? STATES.find((o) => o.label === r.state || o.label.startsWith(r.state + " "))?.value : undefined;
  if (state) out.state = state;
  const t = (r.type ?? "").toUpperCase().replace(/^NBFC-/, "").replace(/\*$/, "");
  const nbfcType = ({ ICC: "icc", MFI: "mfi", HFC: "hfc", FACTOR: "factor", IFC: "ifc" } as Record<string, string>)[t];
  if (nbfcType) out.nbfc_type = nbfcType;
  const layer = r.layer?.startsWith("Base") ? "base" : r.layer?.startsWith("Middle") ? "middle" : undefined;
  if (layer) out.layer = layer;
  if (r.rbiRegNo) out.rbi_cor = r.rbiRegNo;
  return out;
}
