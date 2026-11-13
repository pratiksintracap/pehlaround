# Before the Bell: the model

The one place that says what the product is made of, who sees what, how each thing moves through its life, and the
rules the site must keep. Read it before changing anything; change it in the same commit as the code when a rule moves.
If code and this file disagree, one of them is a bug.

Operator: SintraCap Advisors LLP. Public site and product: beforethebell.in.

---

## 1. Who uses it

| Person | Role in the code | Gets in by | Lands on |
|---|---|---|---|
| Visitor | none | — | the public site |
| Investor in a pending office | `member`, office `approval = pending` | registering | `/dashboard` (names hidden, shelf anonymised) |
| Investor in an approved office | `member`, office `approval = approved` | registering, a desk invite, or a referral link | `/dashboard` |
| Partner firm (broker / wealth manager) | `member`, office `investorType = broker` | a desk partner invite, or the desk sets the type; clients join through its links | `/dashboard` with a Clients tab, and the partner desk at `/dashboard/partner` |
| Relationship manager | a person in a partner firm without commit rights | added by the firm's principal under Team | the same, limited to the clients they introduced |
| Promoter | `promoter`, tied to one deal (`promoterDealId`) | a desk-created login | `/founder` |
| Analyst | `analyst` | invited by the super admin | `/desk` (phone) or `/admin` |
| Super admin | `admin` | the first account, from env | `/desk` or `/admin` |

An **office** is the investing entity (family office, fund, individual, broker). People belong to one office and carry
rights inside it: `View`, `View, comment`, or `View, comment, commit`. Only commit rights may ask for an allocation,
sign an NDA, change the investment profile or give transfer details.

Signed-in people never see the marketing pages: the middleware sends them to their product home. The desk can look at
the public site with `?site=1`.

## 2. What the product is made of

| Thing | Table | One-line meaning |
|---|---|---|
| Office | `offices` | An investing entity, its approval, its investment profile and its referral code |
| Person | `users` | Someone who signs in; belongs to an office, or is desk staff, or a promoter |
| Deal | `deals` | One company's round on the desk, or (if `listed`) a listed-company deal the desk works privately |
| NDA | `ndas` | One office's signed NDA with one company; opens that company's room |
| Document | `documents` | A file in a deal, with an audience (see 4) |
| Question | `questions` | An office's question on a deal and the answer |
| Call | `calls` | A call an office asked for, or a group session the desk set |
| Allocation request | `interests` | An office's non-binding indication for a deal, and what was finally allotted |
| Closing steps | `interests.closing` | The dates of one request's closing: term sheet, documents, funds, shares credited |
| Holders' update | `deal_updates` | A note from a company to the offices that hold its shares, shown once the desk publishes it |
| IPO interest | `ipo_bids` | An office's indication for a company's public issue, taken after the price-band prospectus is filed; not an application |
| Pass | `passes` | An office saying no to a deal, with a reason |
| Partner target | `partner_targets` | What the desk asks a partner firm to bring to one issue (introductions, ₹ Cr), per leg: `pre_ipo` or `ipo` |
| Transfer details | `transfer_kyc`, `kyc_files` | What a share transfer needs from an office, given once for every deal |
| Desk note, file, task | `desk_notes`, `desk_files`, `tasks` | The desk's own working material; never investor-facing |
| Funnel event | `events` | One step an office took (deck opened, NDA signed, allocation requested …) |
| Audit row | `audit` | Who did what and when |

## 3. Lifecycles

Each thing has **one** field that says where it is. Nothing else may be used to decide that.

### Deal: `phase` (what investors see)

```
preparing ──▶ coming ──▶ announced ──▶ open ──▶ closed
    ▲            │            │          │
    └────────────┴────────────┴──────────┘   (the desk can step back at any point)
```

| Phase | Public shelf and overview | Approved investors | NDA can be signed | Room |
|---|---|---|---|---|
| `preparing` | not shown | not shown | no | desk only |
| `coming` | "Coming to the desk": anonymised title, structure, listing year | same | no | desk only |
| `announced` | anonymised card and overview | company name, round, pitch deck | no | desk only |
| `open` | anonymised card and overview | company name, round, pitch deck | **yes** | offices that signed |
| `closed` | card marked "Round closed" | as above | no | offices that signed keep it, for updates and the road to listing |

`published`, `open` and `preview` are read-only columns the database computes from `phase`, kept so existing reads
work. The card tag and status line are also derived from `phase`. Write `phase`, never the flags.

**Listed deals** (`listed = true`, "After the Bell") are a different kind of deal, not a phase. They are always
`preparing`, enforced by a database check, and are kept off every investor surface by `investorWhere` and a build test.

### Deal: `pipelineStage` (the desk's own workflow)

`sourced → diligence → live → interest → docs → escrow → closed`, plus `archived` (dropped, listed elsewhere or not a deal: kept with its history, off the site and the working lists; archiving puts the deal back to `preparing`). Desk only; never shown to investors and never changes
`phase` on its own. The board and the phone desk group deals by it.

### Office: `approval`

`pending → approved | rejected`. Approval opens company names, pitch decks and NDAs. `status` is separate and tracks the
PAN check (`registered → pan_submitted → verified | rejected`).

### Allocation request: `interests.status`

`Indicated → Term sheet → Documents → Allotted`, or `Withdrawn`. Only a super admin moves it (`allocations.confirm`);
the office is told at each step. Allotted rows carry shares, price and date, and feed the Portfolio.

**Closing steps** sit under the status and never replace it: term sheet agreed → documents signed → funds received →
shares credited. A step is done when the desk dated it (`interests.closing`) or the status has moved past it; a later
step done means the earlier ones are (`lib/closing.ts`). The office sees the four steps under Portfolio from the first
one until the request is Allotted, and is told once when each is dated.

### The public issue: `deals.ipo` (the IPO leg)

The same record as the road to listing. `ipoStage` (`lib/ipo.ts`) reads it: `none` until "price band announced"
(`rhp`) has a date that has come; `open` from then until the issue closes (`closes`); `closed` until the listing date;
then `listed`. Nothing about the issue is shown to investors or partners while it is `none`. Offices register, change
or withdraw interest only while it is `open`.

**IPO-only issues** (`deals.ipoOnly`): an IPO for a company that never had a round on the desk, added from the IPO
book. Like a listed deal, it is not a phase: a database check keeps it in `preparing` for good, so it is never on the
shelf, the public site or any round surface. It is shown only as a public issue, by `ipoVisible`, under the same
`ipoStage` rule.

### IPO interest: `ipo_bids.status`

`Indicated → With the lead manager → Applied → Allotted`, or `Withdrawn`. One row per office per issue. The office
moves it only between Indicated and Withdrawn; a super admin moves the rest, and the office is told.

`Awaiting client` comes before all of these when a person at the office's partner firm entered the interest for it
(`/api/office/partner/ipo`, only for a client that person may see). It is not interest yet: `counts()` leaves it out
of every total, target and export. The office confirms or declines, signed in or from the personal link it is sent
(`/ipo/confirm/<token>`: no sign-in, a button press only, works once). Confirming makes it `Indicated`; declining,
`Withdrawn`. The partner firm and the desk are told either way.

### Holders' update: `deal_updates.status`

`draft → published`. The promoter drafts in the founder portal, or the desk writes one; only the desk publishes
(`deals.publish`). Published updates are shown only to offices with an Allotted request in that company, under
Portfolio, marked as written by the company and not audited by the desk. Those offices are told once, on first publish.

### Transfer document: `kyc_files.status`

`received → accepted | redo`. A new upload of the same kind replaces the old (`replacedAt`) and starts again at
`received`.

### Task: `tasks.status`

`open → done`; snoozing moves `dueOn`.

### Debt desk (desk only)
- The three books: Before the Bell = pre-IPO equity; After the Bell = listed-company equity; Debt desk = lending (loans, NCDs, CP, structured credit). A listed company's convertible equity (CCPS, preferential) is After the Bell, not debt.
- `deals.debt` + `deals.debtInfo` (borrower type, facility, amount, tenor, rate band, security, purpose, lenders, source, rating). Loans, NCDs, CP, structured credit and NBFC-to-NBFC raises the desk arranges.
- Desk-only exactly like After the Bell: the database check `deals_debt_desk_only` keeps one in preparation, and `notListed` / `investorVisible` in lib/deal-guard.ts exclude debt deals from every investor read. Console: /admin/debt and /admin/debt/[id]; the pipeline's kind filter has "Debt".

### Holdings outside the desk and followed companies
- `outside_holdings`: an office's unlisted holdings bought elsewhere (added by hand) and listed holdings (imported from a broker's .xlsx/.csv; a new import replaces the last). Values are the office's own price, or the price in the broker's file; none means at cost. The desk takes no view on any price. Only the office sees these: no desk screen reads them. Editing needs commit rights.
- `watches`: companies an office follows (max 100; one per normalised name). Adding an unlisted holding follows it. A daily cron (`watch`) matches names to the public IPO calendar and tells the office once per stage (dates announced, open, closed, listed, with the lock-in end on listing). A company followed late is told only where it stands. `lib/outside.ts`, `lib/watch-alerts.ts`.

## 4. Who sees what

The rule for every investor-facing read: go through `investorWhere` (deals), filter by the signed-in office, and select
named fields, never whole rows.

| Data | Visitor | Pending office | Approved office | Office with the NDA | Promoter (own deal) | Analyst | Super admin |
|---|---|---|---|---|---|---|---|
| Deal title, structure, listing year, Desk Score | yes¹ | yes¹ | yes | yes | yes | yes | yes |
| Company name, round, pre-money, P/E | — | — | yes | yes | yes | yes | yes |
| Pitch deck (`audience = approved`) | — | — | yes | yes | yes | yes | yes |
| Room: financials, peers, risks, Q&A, documents (`nda`) | — | — | — | yes | — | yes | yes |
| Documents for allocation requests (`allocation`) | — | — | — | only if it asked | — | yes | yes |
| Documents for named offices (`offices`) | — | — | — | only if named | — | yes | yes |
| Data bank (Drive) | — | — | — | yes, every open logged | — | yes | yes |
| Other offices' names, NDAs, amounts | **never** | **never** | **never** | **never** | **never**² | yes³ | yes |
| Desk notes, tasks, files, pipeline stage, rubric marks | **never** | **never** | **never** | **never** | **never** | yes | yes |
| Listed deals (After the Bell) | **never** | **never** | **never** | **never** | **never** | yes | yes |
| Holders' updates (published) | — | — | only if allotted | only if allotted | own drafts and status | yes | yes |
| A live public issue: price band, dates, where to apply | — | — | yes | yes | — | yes | yes |
| An office's IPO interest | — | — | own | own | never | yes | yes |
| An office's closing steps | — | own | own | own | — | yes | yes |
| An office's transfer details and files | — | own | own | own | — | status; files if contacts allowed | yes |
| Contact details of office people | — | own office | own office | own office | — | if Settings allows | yes |
| Desk-added investors | — | — | — | — | — | only their own | yes |

¹ Only in phases `coming` (title and structure) and later. ² A promoter sees counts and, if the desk ticks it, the total
indicated; never which office. ³ Except desk-added investors another analyst added.

A partner firm sees, for offices it introduced, which companies they signed NDAs for and the allocations they asked
for; never their documents, questions, notes or log. Inside the firm, a principal (commit rights) sees every client and
every relationship manager; anyone else sees only the clients who registered through their own link
(`offices.referredByUserId`). The rule is `visibleClients` in `lib/partner-math.ts`; the dashboard, the partner desk and
the statement download all read through it. A firm sees its own targets, never another firm's.

## 5. Rules the site keeps

Product and wording rules agreed with the founder. They apply to every page, email, push notification and the app.

**Never on any public or investor surface**
- The desk's fees, success fee, who pays the desk, or any commission, including broker commissions. Not discussed
  either way.
- The percentage the desk invests. The site may say the desk invests its own capital in every deal.
- A finite number or list of checks the desk runs; the exact Desk Score method (the site may say a scoring system exists
  and outline what it weighs).
- A literal valuation limit such as "under 10x".
- Management or team names on beforethebell.in (they are on sintracap.in).
- A view on whether a price is fair.
- Process rules as selling points ("one NDA per company", "deck before the NDA").
- How many deals are on the desk, on the investor dashboard; any "₹0 fee" indicator.
- Listed-company deals, desk notes, tasks and other offices' identities.

**Always**
- "Operated by SintraCap" (not "backed by" or "run by").
- Desk Scores shown are 8.0 or above.
- No minimum ticket anywhere on the site or product, and no mention of one. Individuals declare they are accredited or acknowledge the risks (`risk_ack`; older rows `min_ticket_25l` show neutrally). Room lines that state a minimum are filtered out (`NO_FLOOR`).
- Emails go from desk@beforethebell.in as HTML, signed "Investment Team, Before the Bell", never sent late at night
  (queued for 9 AM IST).
- Public deal pages are "Overview", anonymised until the office is approved.

## 6. Business rules in code

- **NDA**: per company, signed on screen by a person with commit rights in an approved office, with an emailed code.
  Signing opens that room at once (unless `REQUIRE_PAN_VERIFIED`).
- **Desk Score**: weighted rubric (`lib/score.ts`); a total below 8.0 is not saved.
- **Allocation requests**: any amount from the slider's smallest step (₹5 lakh) up to the room's maximum; no minimum is stated. `lib/ticket.ts`.
  A call request creates a task for the deal owner due within the target hours.
- **Round fill**: the desk sets committed ₹ Cr and whether the anchor is in; the room shows a bar.
- **Referrals**: an approved office's code (`?ref=`) is remembered for 90 days and credited on registration. A broker's
  introduced offices appear under its Clients.
- **Partners**: an office of type broker. Each person there has their own invite code (`users.refCode`, nine
  characters; an office's is eight), so a client is credited to the person whose link it used, or to the firm. The link
  for one issue is the public overview with that code (`/deals/<slug>?ref=`): anonymised until the desk approves the
  client. An introduction is a client that signed that company's NDA. The desk sets a target per firm per issue
  (`/admin/partners`); progress is the better of introductions and amount requested. Fees and commissions are never
  shown: "your terms are in your partner agreement".
- **IPO leg**: once a company on the desk files its price-band prospectus, approved offices see the issue under IPOs
  and register interest in ₹ lakh, in the category they will apply in (anchor and QIB only for a SEBI-registered AIF).
  Every surface says the same thing (`IPO_DISCLAIMER`): interest is not an application or a bid and reserves nothing;
  the office applies through its own broker on the terms of the prospectus; anchor allocation is the lead manager's.
  The desk's IPO book (`/admin/ipo`) totals interest by category and by partner firm and exports it for the lead
  manager (super admin). A partner firm sees which of its clients are interested and for how much, against its
  `ipo` target, and may enter interest for a client, which waits for that client's confirmation. Offices that signed the company's NDA are told when the issue opens.
- **Sellers**: a "wants to sell" lead is matched to approved offices on `/admin/sellers` (`lib/seller-match.ts`):
  already in that company's room, buys pre-IPO secondaries, invests in the sector the desk set, ticket against the
  size of the holding. Partner firms are never matched. Desk only: nothing is sent and no office sees a holding.
- **Monday note to partners** (`lib/partner-digest.ts`, Settings switch): each approved partner firm's principals get
  progress against targets, clients who joined, IPO interest awaiting a client and what is open. Only firms with
  clients or targets; once a Monday; never fees or another firm's numbers.
- **Teasers**: built only from public fields; the company name is stripped as a last check.
- **Transfer readiness**: PAN, demat, CML, cancelled cheque, and authority for entities. Ready = all given; checked =
  all accepted by the desk.
- **Call list**: offices ranked by recent signals (`lib/call-list.ts`); anyone noted by the desk in two days drops down.
- **Removing a deal**: super admin only, unpublished, with nothing attached. Anything with history is closed, not removed.

## 7. How the code is laid out

| Area | Where |
|---|---|
| Public pages | `app/(page)` at the top level: `/`, `/deals`, `/raise`, `/ipo-calendar`, `/articles` … |
| Investor product | `/dashboard`, `/deals/[slug]` (signed in), `/room/[slug]`, `/notifications` |
| IPO leg | `lib/ipo.ts`, the IPOs panel on `/dashboard`, `/api/office/ipo`; the desk's book at `/admin/ipo` |
| Partner desk | `/dashboard/partner`, `lib/partner.ts`, `lib/partner-math.ts`; the desk's side at `/admin/partners` |
| Founder portal | `/founder` |
| Desk on the phone | `/desk` |
| Desk console | `/admin` |
| Rules for roles | `lib/perm.ts` |
| Listed guard | `lib/deal-guard.ts` |
| Deal lifecycle | `lib/phase.ts` |
| Forms | `lib/form.ts` (server) and `components/Form.tsx` (client): one way to submit, results shown in place |
| UI kit | `components/ui.tsx` |

Tests that hold the rules: `tests/listed-guard*.test.ts` (listed deals), `tests/investor-privacy.test.ts` (desk data),
`tests/phase.test.ts` (lifecycle), `tests/partner.test.ts` (who in a partner firm sees which clients), `tests/closing.test.ts` (closing steps), `tests/ipo.test.ts` (when an issue is shown and who may choose which category), `tests/four-more.test.ts` (IPO-only issues, client confirmation, seller matching), plus feature tests.
