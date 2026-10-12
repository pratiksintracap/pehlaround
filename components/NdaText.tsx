export function NdaText({ company, office, version }: { company: string; office: string; version: string }) {
  return (
    <div className="nda-text">
      <p><strong>Agreement</strong> between {company} (“the Company”) and {office} (“the Office”). Pehla Round, operated by SintraCap Advisors LLP, facilitates the agreement and hosts the data room. Version {version}.</p>
      <ol>
        <li><strong>Confidential information.</strong> The Company&apos;s financial information, valuation, documents, promoter sessions, questions and answers, and the identity of other investors in this round are confidential, whether marked or not.</li>
        <li><strong>Use.</strong> The Office uses it only to evaluate an investment by the Office in the Company.</li>
        <li><strong>Sharing.</strong> The Office may share it with its principals, employees and professional advisers who need it for that evaluation and are bound by the same obligations. It will not forward, copy or publish it, and will not share it with another investor or intermediary.</li>
        <li><strong>No dealing.</strong> Where the Company has listed securities, the Office will not deal in them on the basis of unpublished price-sensitive information received in the room.</li>
        <li><strong>Records.</strong> The room logs what the Office opens, to keep the records that private placement law requires.</li>
        <li><strong>Scope.</strong> This agreement covers the Company only. It gives no access to any other deal or company on the desk.</li>
        <li><strong>Duration.</strong> Three years from each disclosure, or until the information becomes public through no fault of the Office.</li>
      </ol>
    </div>
  );
}
