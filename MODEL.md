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
| Broker / wealth manager | `member`, office `investorType = broker` | as an investor; clients join through its invite link | `/dashboard` with a Clients tab |
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
| Pass | `passes` | An office saying no to a deal, with a reason |
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

`sourced → diligence → live → interest → docs → escrow → closed`. Desk only; never shown to investors and never changes
`phase` on its own. The board and the phone desk group deals by it.

### Office: `approval`

`pending → approved | rejected`. Approval opens company names, pitch decks and NDAs. `status` is separate and tracks the
PAN check (`registered → pan_submitted → verified | rejected`).

### Allocation request: `interests.status`

`Indicated → Term sheet → Documents → Allotted`, or `Withdrawn`. Only a super admin moves it (`allocations.confirm`);
the office is told at each step. Allotted rows carry shares, price and date, and feed the Portfolio.

### Transfer document: `kyc_files.status`

`received → accepted | redo`. A new upload of the same kind replaces the old (`replacedAt`) and starts again at
`received`.

### Task: `tasks.status`

`open → done`; snoozing moves `dueOn`.

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
| An office's transfer details and files | — | own | own | own | — | status; files if contacts allowed | yes |
| Contact details of office people | — | own office | own office | own office | — | if Settings allows | yes |
| Desk-added investors | — | — | — | — | — | only their own | yes |

¹ Only in phases `coming` (title and structure) and later. ² A promoter sees counts and, if the desk ticks it, the total
indicated; never which office. ³ Except desk-added investors another analyst added.

A broker sees, for offices it introduced, which companies they signed NDAs for and the allocations they asked for;
never their documents, questions, notes or log.

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
- HNI minimum ticket: ₹25 lakh per company (Settings, `hniMinCr`).
- Emails go from desk@beforethebell.in as HTML, signed "Investment Team, Before the Bell", never sent late at night
  (queued for 9 AM IST).
- Public deal pages are "Overview", anonymised until the office is approved.

## 6. Business rules in code

- **NDA**: per company, signed on screen by a person with commit rights in an approved office, with an emailed code.
  Signing opens that room at once (unless `REQUIRE_PAN_VERIFIED`).
- **Desk Score**: weighted rubric (`lib/score.ts`); a total below 8.0 is not saved.
- **Allocation requests**: minimum ticket from the deal, or the HNI minimum for individuals; step from `lib/ticket.ts`.
  A call request creates a task for the deal owner due within the target hours.
- **Round fill**: the desk sets committed ₹ Cr and whether the anchor is in; the room shows a bar.
- **Referrals**: an approved office's code (`?ref=`) is remembered for 90 days and credited on registration. A broker's
  introduced offices appear under its Clients.
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
| Founder portal | `/founder` |
| Desk on the phone | `/desk` |
| Desk console | `/admin` |
| Rules for roles | `lib/perm.ts` |
| Listed guard | `lib/deal-guard.ts` |
| Deal lifecycle | `lib/phase.ts` |
| Forms | `lib/form.ts` (server) and `components/Form.tsx` (client): one way to submit, results shown in place |
| UI kit | `components/ui.tsx` |

Tests that hold the rules: `tests/listed-guard*.test.ts` (listed deals), `tests/investor-privacy.test.ts` (desk data),
`tests/phase.test.ts` (lifecycle), plus feature tests.
