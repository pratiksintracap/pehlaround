// The NDA wording, in one place, so the on-screen agreement, the signed copy and the PDF always match.
export const ndaParties = (company: string, office: string, version: string) =>
  `Agreement between ${company} (“the Company”) and ${office} (“the Office”). Off Market Desk, operated by SintraCap Advisors LLP, facilitates the agreement and hosts the data room. Version ${version}.`;

export const NDA_CLAUSES: [string, string][] = [
  ["Confidential information.", "The Company’s financial information, valuation, documents, promoter sessions, questions and answers, and the identity of other investors in this round are confidential, whether marked or not."],
  ["Use.", "The Office uses it only to evaluate an investment by the Office in the Company."],
  ["Sharing.", "The Office may share it with its principals, employees and professional advisers who need it for that evaluation and are bound by the same obligations. It will not forward, copy or publish it, and will not share it with another investor or intermediary."],
  ["No dealing.", "Where the Company has listed securities, the Office will not deal in them on the basis of unpublished price-sensitive information received in the room."],
  ["Records.", "The room logs what the Office opens, to keep the records that private placement law requires."],
  ["Scope.", "This agreement covers the Company only. It gives no access to any other deal or company on the desk."],
  ["Duration.", "Three years from each disclosure, or until the information becomes public through no fault of the Office."],
];
