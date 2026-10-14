import { NDA_CLAUSES } from "@/lib/nda";

export function NdaText({ company, office, version }: { company: string; office: string; version: string }) {
  return (
    <div className="nda-text">
      <p><strong>Agreement</strong> between {company} (“the Company”) and {office} (“the Office”). Before the Bell, operated by SintraCap Advisors LLP, facilitates the agreement and hosts the data room. Version {version}.</p>
      <ol>{NDA_CLAUSES.map(([t, b]) => <li key={t}><strong>{t}</strong> {b}</li>)}</ol>
    </div>
  );
}
