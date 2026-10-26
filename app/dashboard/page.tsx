import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";
import { audit, calls, docViews, documents, interests, invites, ndas, passes, questions, tickets, users , deals as dealsT, deskInvites, offices } from "@/db/schema";
import { CATEGORIES, STATUS, catLabel, ticketNo } from "@/lib/tickets";
import { listDeals, canSeeNames , signedDealIds } from "@/lib/deals";
import { monthsTo } from "@/lib/render";
import { AppPromo } from "@/components/AppPromo";
import { GRIEVANCE, DESK_EMAIL } from "@/lib/site";
import { parsePromises, answerStats } from "@/lib/promises";
import { Analyst } from "@/components/Analyst";
import { aiReady, starters } from "@/lib/ai";
import { AUM, CATEGORY, HORIZON, RESIDENCY, SECTORS, STRUCTURES, TICKET, completeness, fit } from "@/lib/profile";
import { isDesk } from "@/lib/perm";
import { holding, crore, fmtDay } from "@/lib/portfolio";
import { SITE_URL } from "@/lib/site";
import { officeRefCode } from "@/lib/track";
import { investorWhere } from "@/lib/deal-guard";
import { DeckPanel } from "@/components/DeckPanel";

export const metadata: Metadata = { title: "Your office", robots: { index: false } };
type P = { searchParams: Promise<{ msg?: string; error?: string; deal?: string; cat?: string; show?: string }> };

const fmtD = (d: Date | null) => d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

const PR_ICONS = [
  "M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3", // lock open
  "M4 5h16v11H9l-5 4zM8 9h8M8 12h5", // question
  "M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z", // phone
  "M4 12l5 5L20 6", // tick
  "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5", // document
  "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", // eye
  "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z", // shield
  "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", // clock
];

export default async function Dashboard({ searchParams }: P) {
  const user = await requireUser("/dashboard");
  // The desk has no office view: in the phone app it lands on its own Today screen, in a browser on the console.
  if (isDesk(user) && !user.officeId) redirect(/BeforeTheBellApp/.test((await headers()).get("user-agent") || "") ? "/desk" : "/admin");
  if (user.role === "promoter") redirect("/founder");
  // Registered from a deal: once approved, take them straight back to it (once).
  if (user.intent && user.office?.approval === "approved") {
    const want = user.intent;
    await (await getDb()).update(users).set({ intent: null }).where(eq(users.id, user.id));
    const d = (await listDeals()).find((x) => x.slug === want);
    if (d && d.open && !(await signedDealIds(user.officeId)).has(d.id)) redirect(`/deals/${d.slug}#sign`);
  }
  const { msg, error, deal: tDeal, cat: tCat, show = "" } = await searchParams;
  const office = user.office!;
  const db = await getDb();
  const [allDeals, names, st, ans] = await Promise.all([listDeals(), canSeeNames(user), getSettings(), answerStats()]);
  const promises = parsePromises(st.promises);
  const aiOn = aiReady() && st.aiAnalyst && names;
  const deals = names ? allDeals : allDeals.map((d) => ({ ...d, company: d.title, roundLabel: "After approval", preMoney: "After approval", peLabel: "After approval" }));
  const pendingApproval = !names;
  const byId = new Map(deals.map((d) => [d.id, d]));
  const [myNdas, myInterests, myPasses, myCalls, myQs, team, pending, log, views] = await Promise.all([
    db.select().from(ndas).where(and(eq(ndas.officeId, office.id), isNull(ndas.revokedAt))).orderBy(desc(ndas.signedAt)),
    db.select().from(interests).where(eq(interests.officeId, office.id)).orderBy(desc(interests.createdAt)),
    db.select().from(passes).where(eq(passes.officeId, office.id)).orderBy(desc(passes.createdAt)),
    db.select().from(calls).where(eq(calls.officeId, office.id)).orderBy(desc(calls.createdAt)),
    db.select().from(questions).where(eq(questions.officeId, office.id)).orderBy(desc(questions.askedAt)),
    db.select().from(users).where(eq(users.officeId, office.id)),
    db.select().from(invites).where(and(eq(invites.officeId, office.id), isNull(invites.acceptedAt))),
    db.select().from(audit).where(eq(audit.officeId, office.id)).orderBy(desc(audit.at)).limit(200),
    db.select({ at: docViews.at, title: documents.title, dealId: documents.dealId, userId: docViews.userId }).from(docViews)
      .innerJoin(documents, eq(documents.id, docViews.documentId)).where(eq(docViews.officeId, office.id)).orderBy(desc(docViews.at)).limit(100),
  ]);
  const refs = await db.select().from(deskInvites).where(eq(deskInvites.referrerOfficeId, office.id)).orderBy(desc(deskInvites.createdAt)).limit(10);
  // The office's own invite link, created the first time an approved office opens this page.
  const refCode = office.approval === "approved" ? await officeRefCode(office.id, office.refCode) : null;
  const referredCount = refCode ? (await db.select({ n: sql<number>`count(*)::int` }).from(offices).where(eq(offices.referredBy, office.id)))[0]?.n ?? 0 : 0;
  // A broker sees the offices it introduced (through its invite link): which companies they signed for and what they
  // asked for. Not their documents, questions, notes or log. An office introduced by a broker is told so (Team).
  const isBroker = office.investorType === "broker";
  const clients = isBroker ? await db.select({ id: offices.id, name: offices.name, approval: offices.approval, createdAt: offices.createdAt }).from(offices).where(eq(offices.referredBy, office.id)).orderBy(desc(offices.createdAt)) : [];
  const cIds = clients.map((c) => c.id);
  const [cNdas, cAsks] = cIds.length ? await Promise.all([
    db.select({ officeId: ndas.officeId, dealId: ndas.dealId, signedAt: ndas.signedAt }).from(ndas).where(and(inArray(ndas.officeId, cIds), isNull(ndas.revokedAt))),
    db.select({ officeId: interests.officeId, dealId: interests.dealId, amountCr: interests.amountCr, status: interests.status, createdAt: interests.createdAt }).from(interests).where(inArray(interests.officeId, cIds)).orderBy(desc(interests.createdAt)),
  ]) : [[], []];
  const [introducer] = office.referredBy ? await db.select({ name: offices.name, investorType: offices.investorType }).from(offices).where(eq(offices.id, office.referredBy)) : [];
  const myTickets = await db.select().from(tickets).where(eq(tickets.officeId, office.id)).orderBy(desc(tickets.updatedAt));
  const ticketsWaiting = myTickets.filter((t) => t.status === "answered").length;
  const signed = new Set(myNdas.map((n) => n.dealId));
  const sessions = signed.size ? await db.select().from(calls).where(and(eq(calls.kind, "session"), inArray(calls.dealId, [...signed]))).orderBy(desc(calls.createdAt)) : [];
  const userName = new Map(team.map((u) => [u.id, u.name]));
  const allotted = myInterests.filter((i) => i.status === "Allotted");
  // The road to listing straight from the database, so a step the desk just added shows at once.
  const ipoNow = new Map(allotted.length ? (await db.select({ id: dealsT.id, ipo: dealsT.ipo }).from(dealsT).where(investorWhere(inArray(dealsT.id, allotted.map((x) => x.dealId))))).map((r) => [r.id, r.ipo]) : []);
  const holdings = allotted.map((a) => { const b = byId.get(a.dealId); const d = b ? { ...b, ipo: ipoNow.get(a.dealId) ?? b.ipo } : b; return { a, d, h: holding(a, d?.ipo ?? {}) }; });
  const pfCost = holdings.reduce((t, x) => t + x.h.costRs, 0);
  const marked = holdings.filter((x) => x.h.value);
  const pfMarked = marked.length, pfValue = marked.reduce((t, x) => t + x.h.value!.rs, 0), pfMarkedCost = marked.reduce((t, x) => t + x.h.costRs, 0);
  const pfNext = holdings.map((x) => { const st = x.h.steps.find((z) => z.now); return st ? { step: st.label, company: x.d?.company ?? "" } : null; }).find(Boolean) ?? null;
  const indicated = myInterests.filter((i) => i.status !== "Withdrawn");
  const totalInd = indicated.reduce((s, i) => s + Number(i.amountCr), 0);
  // deals this office has passed on (its latest word on the deal, unless it asked for an allocation after passing)
  const lastAsk = new Map<number, Date>(); for (const i of myInterests) if (!lastAsk.has(i.dealId)) lastAsk.set(i.dealId, i.createdAt);
  const passedBy = new Map<number, (typeof myPasses)[number]>(), seenPass = new Set<number>();
  for (const p of myPasses) { if (seenPass.has(p.dealId)) continue; seenPass.add(p.dealId); const a = lastAsk.get(p.dealId); if (!a || a < p.createdAt) passedBy.set(p.dealId, p); }
  // the room this office was in last (from its own log), else the NDA it signed most recently; never one it passed on
  const live = (id: number | null) => !!id && signed.has(id) && !passedBy.has(id);
  const lastOpened = log.find((l) => live(l.dealId) && l.action.startsWith("Opened the room")) ?? log.find((l) => live(l.dealId));
  const latest = byId.get(lastOpened?.dealId ?? myNdas.find((n) => !passedBy.has(n.dealId))?.dealId ?? -1);
  const topPick = [...deals].filter((d) => d.open && !signed.has(d.id)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  // progress: four steps, shown until the office has a room open
  const steps: [string, string, "done" | "now" | "todo"][] = [
    ["Registered", "Your office is on the desk", "done"],
    ["Approved", names ? "Every company is open to you by name" : `The desk reviews new offices, ${st.approvalTime}`, names ? "done" : "now"],
    ["First NDA signed", signed.size ? "Signed with your name and an email code" : "Your name and a code we email you; nothing else", signed.size ? "done" : names ? "now" : "todo"],
    ["Rooms open", signed.size ? `${signed.size} ${signed.size === 1 ? "room" : "rooms"} open to you` : "Numbers, documents and Q&A for each company", signed.size ? "done" : "todo"],
  ];
  const showSteps = !signed.size;
  const profileGaps = [!office.category && "category", !office.residency && "residency", !office.ticket && "ticket"].filter(Boolean) as string[];
  const welcome = names && !signed.size; // approved but no room yet: the welcome pop-up guides the first step
  const canCommit = /commit/i.test(user.rights);
  const prof = completeness(office);
  const fits = new Map(deals.map((d) => [d.id, fit(office, d)]));
  // Deals whose pitch deck, IM or teaser is open before the NDA: the shelf leads with it.
  const deckRows = names ? await db.select({ id: documents.id, d: documents.dealId, title: documents.title, status: documents.status, url: documents.url, sort: documents.sort })
    .from(documents).where(eq(documents.audience, "approved")).orderBy(documents.sort, documents.id) : [];
  const deckOf = new Map<number, { id: number; title: string }>();
  for (const r of deckRows) if (r.status === "available" && r.url && !deckOf.has(r.d)) deckOf.set(r.d, { id: r.id, title: r.title });
  const deckDeals = new Set(deckRows.map((r) => r.d));
  // One line per deal: where this office stands with it, and the single next thing to do.
  const qByDeal = new Map<number, { n: number; open: number }>();
  for (const q of myQs) { const x = qByDeal.get(q.dealId) ?? { n: 0, open: 0 }; x.n++; if (!q.answer) x.open++; qByDeal.set(q.dealId, x); }
  const askOf = new Map<number, (typeof indicated)[number]>(); for (const i of indicated) if (!askOf.has(i.dealId)) askOf.set(i.dealId, i);
  type Row = { d: (typeof deals)[number]; key: string; label: string; tone: string; detail: string; primary?: { href: string; text: string; deck?: boolean }; };
  const rowFor = (d: (typeof deals)[number]): Row => {
    const ask = askOf.get(d.id), q = qByDeal.get(d.id), ps = passedBy.get(d.id), deck = deckOf.get(d.id);
    const qs = q ? ` · ${q.n} question${q.n === 1 ? "" : "s"}${q.open ? `, ${q.open} awaiting` : ""}` : "";
    if (ask?.status === "Allotted") return { d, key: "rooms", label: "Allotted", tone: "ok", detail: `₹${Number(ask.amountCr)} Cr allotted`, primary: { href: "#Portfolio", text: "See holding" } };
    if (ps) return { d, key: "passed", label: "Passed", tone: "off", detail: `“${ps.reason}”`, primary: signed.has(d.id) ? { href: `/room/${d.slug}`, text: "Open room" } : undefined };
    if (ask) return { d, key: "requested", label: `Requested ₹${Number(ask.amountCr)} Cr`, tone: "ok", detail: `${ask.status}${qs}`, primary: { href: `/room/${d.slug}`, text: "Open room" } };
    if (signed.has(d.id)) return { d, key: "rooms", label: "Room open", tone: "ok", detail: `NDA signed${qs}`, primary: { href: `/room/${d.slug}`, text: "Open room" } };
    if (!names) return { d, key: "new", label: "After approval", tone: "", detail: "Company names open once the desk approves your office", primary: { href: `/deals/${d.slug}`, text: "Overview" } };
    if (d.open) return { d, key: "new", label: "Not opened yet", tone: "mid", detail: deck ? "Read the deck, then sign the NDA to open the room" : "Sign the NDA to open the room", primary: deck ? { href: `/api/docs/${deck.id}?embed=1`, text: "Pitch deck", deck: true } : { href: `/deals/${d.slug}#sign`, text: "Sign NDA" } };
    return { d, key: "new", label: "Room not open yet", tone: "", detail: "The desk is preparing the room", primary: deck ? { href: `/api/docs/${deck.id}?embed=1`, text: "Pitch deck", deck: true } : { href: `/deals/${d.slug}`, text: "Overview" } };
  };
  const rows = deals.map(rowFor);
  const FILTERS: [string, string, number][] = [["", "All", rows.length], ["new", "Not opened", rows.filter((r) => r.key === "new").length], ["rooms", "Rooms open", rows.filter((r) => r.key === "rooms").length], ["requested", "Requested", rows.filter((r) => r.key === "requested").length], ["passed", "Passed", rows.filter((r) => r.key === "passed").length]];
  const shown = show ? rows.filter((r) => r.key === show) : rows;
  const NAV: [string, string, string, number | null][] = [
    ["Shelf", "Your deals", "M3 7h18M3 12h18M3 17h12", null],
    ["Rooms", "Questions and requests", "M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M9 21v-6h6v6", signed.size || null],
    ["Calls", "Calls", "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2", null],
    ["Documents", "Documents", "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6", null],
    ...(isBroker ? [["Clients", "Your clients", "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8", clients.length || null] as [string, string, string, number | null]] : []),
    ["Portfolio", "Portfolio", "M4 19V9M10 19V5M16 19v-7M22 19H2", allotted.length || null],
    ["Profile", "Investment profile", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0", null],
    ["Team", "Team", "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8", team.length > 1 ? team.length : null],
    ["Log", "Activity log", "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", null],
    ["Support", "Help and support", "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.9 4.9l4.3 4.3M14.8 14.8l4.3 4.3M14.8 9.2l4.3-4.3M4.9 19.1l4.3-4.3", ticketsWaiting || null],
  ];

  return (
    <main><div className="wrap app-wrap"><div className="app dm" id="dash">
      <div className="dm-scrim" aria-hidden="true" />
      <aside className="app-side" id="dash-menu" aria-label="Your office">
        <div className="as-office">
          <span className="as-av" aria-hidden="true">{office.name.trim().slice(0, 1).toUpperCase()}</span>
          <div><b>{office.name}</b><small>{names ? "Approved by the desk" : "Awaiting approval"}{office.city ? ` · ${office.city}` : ""}</small></div>
        </div>
        <a className="as-prof" href="#Profile" title={prof.missing.length ? `Still to add: ${prof.missing.join(", ")}` : "Your profile is complete"}>
          <span><b>Investment profile</b><small>{prof.pct === 100 ? "Complete" : `${prof.pct}% complete · add ${prof.missing[0].toLowerCase()}`}</small></span>
          <i className="as-meter" aria-hidden="true"><i style={{ width: `${prof.pct}%` }} /></i>
        </a>
        <nav className="side-nav" role="tablist" aria-label="Dashboard sections">
          {NAV.map(([k, t, ic, n], i) => (
            <button key={k} role="tab" type="button" className="tabbtn" data-tab={k} aria-selected={i === 0}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ic} /></svg><span>{t}</span>{n ? <em>{n}</em> : null}</button>))}
        </nav>
        {aiOn && <button type="button" className="as-ai" data-open-analyst=""><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.5l-1.8-5L5 9.7l5.2-1.8zM18.5 15l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" /></svg><span><b>Ask the analyst</b><small>AI on your rooms, peers and sectors</small></span></button>}
        <div className="as-foot">
          <a href="/app?install=1" data-get-app="">Get the app</a>
          <a href="#Support">Raise a ticket</a>
        </div>
      </aside>
      <div className="app-main">
      <div className="dashhead">
        <div className="dh-name"><button type="button" className="dm-btn" data-menu="" aria-expanded="false" aria-controls="dash-menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>Menu <em data-menu-label="" suppressHydrationWarning>{NAV[0][1]}</em></button><span className="eyebrow">Office dashboard</span><h1>{office.name}</h1></div>
        <div className="dh-stats">
          <a href="/dashboard?show=rooms#Shelf"><b>{signed.size}</b><span>{signed.size === 1 ? "room open" : "rooms open"}</span></a>
          <a href="#Rooms"><b>{myQs.length}</b><span>{myQs.length ? `questions · ${myQs.filter((q) => q.answer).length} answered` : "questions"}</span></a>
          <a href="/dashboard?show=requested#Shelf"><b>{indicated.length ? `₹${+totalInd.toFixed(2)} Cr` : "0"}</b><span>{indicated.length ? `requested · ${indicated.length}` : "allocations requested"}</span></a>
          {latest && <a className="btn primary sm dh-go" href={`/room/${latest.slug}`}>Continue in {latest.company} →</a>}
        </div>
      </div>
      {msg && <p className="notice" style={{ marginTop: 12 }}>{msg}</p>}
      {error && <p className="notice" style={{ marginTop: 12, borderColor: "var(--warn, #c0392b)" }}>{error}</p>}

      {showSteps && (
        <section className="nextstep" aria-label="Your progress">
          <ol className="osteps">{steps.map(([t, sub, c], i) => (
            <li key={t} className={c} aria-current={c === "now" ? "step" : undefined}><span className="dot" aria-hidden="true">{c === "done" ? "✓" : i + 1}</span><div><b>{t}</b><small>{sub}</small></div></li>))}</ol>
          <div className="ns-act">
            {pendingApproval ? <p className="fine">You can browse the shelf below in the meantime. We will tell you under the bell and by email the moment your office is approved.</p>
              : !signed.size && topPick ? <><a className="btn primary" href={`/deals/${topPick.slug}#sign`}>Open your first room: {topPick.company}</a><a className="btn ghost" href="#Shelf">Or choose from the shelf ↓</a></>
              : null}
          </div>
        </section>
      )}


      <section className="panel" data-panel="Shelf">
        <nav className="dk-chips dl-filter" aria-label="Show">
          {FILTERS.filter(([k, , n]) => !k || n).map(([k, l, n]) => <a key={k} href={`/dashboard${k ? `?show=${k}` : ""}#Shelf`} aria-current={show === k ? "true" : undefined}>{l} <span>{n}</span></a>)}
        </nav>
        <ul className="dealrows">{shown.map(({ d, label, tone, detail, primary }) => (
          <li key={d.id} className="dr">
            <div className="dr-main">
              <div className="dr-name"><b>{d.company}</b>{names && <small>{d.title}</small>}</div>
              <div className="dr-status"><span className={`pill ${tone}`}>{label}</span><small>{detail}</small>
                {!passedBy.has(d.id) && fits.get(d.id) && <span className="fitpill" title={fits.get(d.id)!}>Fits your thesis</span>}</div>
            </div>
            <dl className="dr-facts">
              <div><dt>Structure</dt><dd>{d.category}</dd></div>
              <div><dt>Round</dt><dd>{d.roundLabel || "—"}</dd></div>
              <div><dt>Pre-money</dt><dd>{d.preMoney || "—"}</dd></div>
              <div><dt>P/E</dt><dd>{d.peLabel || "—"}</dd></div>
              <div><dt>Listing</dt><dd>{d.listingLabel}{d.listingNote ? ` · ${d.listingNote}` : ""}</dd></div>
              <div><dt>Min ticket</dt><dd>{d.minTicket || "—"}</dd></div>
              {d.score != null && <div><dt>Desk Score</dt><dd>{d.score.toFixed(1)}</dd></div>}
            </dl>
            <div className="dr-acts">
              {primary && (primary.deck
                ? <a className="btn sm primary" href={primary.href} data-deck={primary.href} data-deck-title={`${d.company}: pitch deck`} data-deck-next={d.open && !signed.has(d.id) ? `/deals/${d.slug}#sign` : undefined}>{primary.text}</a>
                : <a className="btn sm primary" href={primary.href}>{primary.text}</a>)}
              {deckOf.has(d.id) && !primary?.deck && <a className="btn sm" href={`/api/docs/${deckOf.get(d.id)!.id}?embed=1`} data-deck={`/api/docs/${deckOf.get(d.id)!.id}?embed=1`} data-deck-title={`${d.company}: pitch deck`}>Deck</a>}
              {!signed.has(d.id) && d.open && names && primary?.deck && <a className="btn sm" href={`/deals/${d.slug}#sign`}>Sign NDA</a>}
              <a className="btn sm ghost" href={`/deals/${d.slug}`}>Overview</a>
            </div>
          </li>))}
          {!shown.length && <li className="empty-li">Nothing here. <a href="/dashboard#Shelf">Show all deals</a></li>}
        </ul>
        <p className="fine">Every deal on the desk, where your office stands with it, and the next step.</p>
        {promises.length > 0 && (
          <section className="promises" id="promises" aria-label="What the desk commits to">
            <div className="pr-head"><h2 className="tt">What the desk commits to.<span className="tt2">Hold us to it.</span></h2>
              <a className="btn sm ghost" href="/dashboard?cat=other#Support">Tell us if we miss one</a></div>
            <ul className="pr-grid">{promises.map((p, i) => {
              const measured = ans && /question|answer/i.test(p.title);
              return (
                <li key={p.title}><span className="pr-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={PR_ICONS[i % PR_ICONS.length]} /></svg></span>
                  <div><b>{p.title}</b>{p.detail && <p>{p.detail}</p>}
                    {measured && ans && <span className="pr-live" title={`${ans.count} questions answered in the last 90 days`}><i />Last 90 days: median {ans.medianHours < 1 ? "under an hour" : `${Math.round(ans.medianHours)} hours`} · {Math.round(ans.within48 * 100)}% within 48 hours</span>}</div></li>);
            })}</ul>
          </section>
        )}
        <AppPromo variant="bar" text="New deals, promoter answers and approvals on your home screen, the moment they land." />
      </section>

      <section className="panel" data-panel="Rooms" hidden>
        <div className="two">
          <div className="chart"><span className="k">Rooms open to your office</span><ul className="roomlist">
            {myNdas.length ? [...myNdas].sort((a, b) => Number(passedBy.has(a.dealId)) - Number(passedBy.has(b.dealId))).map((n) => { const dd = byId.get(n.dealId), ps = passedBy.get(n.dealId); return dd ? (
              <li key={n.id} className={ps ? "passed" : undefined}><div><b>{dd.company}{ps && <> <span className="pill off">Passed</span></>}</b>
                <small>{dd.category} · {ps ? `Passed ${fmtD(ps.createdAt)}: “${ps.reason}”` : `NDA signed ${fmtD(n.signedAt)}`}</small></div>
                <a className={`btn sm ${ps ? "" : "primary"}`} href={`/room/${dd.slug}`}>Open room</a></li>) : null; })
              : <li className="empty-li">No rooms yet. Sign a company&apos;s NDA from the Shelf.</li>}</ul></div>
          <div className="chart"><span className="k">Allocations requested</span><ul className="feed">
            {indicated.length ? indicated.map((i) => <li key={i.id}><b>{byId.get(i.dealId)?.company}</b> · ₹{Number(i.amountCr)} Cr{i.colead ? " · co-lead interest" : ""} · {i.status} · {fmtD(i.createdAt)}</li>)
              : <li className="empty-li">None yet.</li>}</ul></div>
          <div className="chart"><span className="k">Passed, with your reason</span><ul className="feed">
            {myPasses.length ? myPasses.map((p) => <li key={p.id}><b>{byId.get(p.dealId)?.company}</b> · “{p.reason}{p.note ? ` · ${p.note}` : ""}” · {fmtD(p.createdAt)}</li>)
              : <li className="empty-li">Nothing passed.</li>}</ul></div>
          <div className="chart"><span className="k">Your questions</span><ul className="feed">
            {myQs.length ? myQs.map((q) => <li key={q.id}><b>{byId.get(q.dealId)?.company}</b> · {q.question} · {q.answer ? <span className="pill ok">Answered</span> : <span className="pill">Awaiting</span>}</li>)
              : <li className="empty-li">No questions yet. Ask from any room&apos;s Q&amp;A.</li>}</ul></div>
        </div>
      </section>

      <section className="panel" data-panel="Calls" hidden>
        <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Deal</th><th>Call</th><th>Status</th><th>When</th><th>Summary</th></tr></thead><tbody>
          {[...sessions, ...myCalls].length ? [...sessions, ...myCalls].map((c) => (
            <tr key={c.id}><th scope="row">{byId.get(c.dealId)?.company}</th>
              <td>{c.kind === "session" ? (c.title || "Group session") : `Management call requested · ${c.slot}`}</td>
              <td><span className={`pill ${c.status === "Held" ? "ok" : ""}`}>{c.status}</span></td>
              <td>{c.scheduledFor || fmtD(c.createdAt)}</td><td>{c.summary || (c.status === "Held" ? "Posted to the room" : "Posted after the call")}</td></tr>
          )) : <tr><td colSpan={5} className="fine">No calls yet. Request one from a room&apos;s Q&amp;A panel.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="panel" data-panel="Documents" hidden>
        <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Document</th><th>Deal</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>
          {myNdas.map((n) => (
            <tr key={`n${n.id}`}><th scope="row">NDA with {byId.get(n.dealId)?.company}</th><td>{byId.get(n.dealId)?.title}</td>
              <td><span className="pill ok">Signed · version {n.version}</span></td><td>{fmtD(n.signedAt)}</td><td><div style={{ display: "flex", gap: 6 }}><a className="btn sm" href={`/dashboard/nda/${n.id}`}>View</a><a className="btn sm" href={`/dashboard/nda/${n.id}/pdf`} target="_blank" rel="noopener">PDF</a></div></td></tr>
          ))}
          <tr><th scope="row">KYC pack: address, bank, demat, authorised signatory</th><td>Office</td><td><span className="pill">At commitment</span></td><td>—</td><td /></tr>
        </tbody></table></div>
        {views.length > 0 && <>
          <h3 style={{ marginTop: 18 }}>Documents your office opened</h3>
          <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>When</th><th>Who</th><th>Document</th><th>Deal</th></tr></thead><tbody>
            {views.map((v, i) => <tr key={i}><td>{fmtT(v.at)}</td><td>{userName.get(v.userId) || "—"}</td><td>{v.title}</td><td>{byId.get(v.dealId)?.company}</td></tr>)}
          </tbody></table></div>
        </>}
        <p className="fine">Every document view is written to the activity log.</p>
      </section>

      {isBroker && <section className="panel" data-panel="Clients" hidden>
        <div className="panel-head"><div><h2>Your clients</h2><p className="fine">Offices that registered through your invite link. You see which companies they have signed NDAs for and the allocations they asked for. Their documents, questions and notes stay private to them. Share your link from Team.</p></div></div>
        {clients.length ? <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Client</th><th>Status</th><th>NDAs signed</th><th>Allocations requested</th></tr></thead><tbody>
          {clients.map((c) => { const n = cNdas.filter((x) => x.officeId === c.id), a = cAsks.filter((x) => x.officeId === c.id && x.status !== "Withdrawn"); return (
            <tr key={c.id}><th scope="row">{c.name}<br /><small className="fine">Joined {fmtD(c.createdAt)}</small></th>
              <td><span className={`pill ${c.approval === "approved" ? "ok" : ""}`}>{c.approval === "approved" ? "Approved" : c.approval === "rejected" ? "On hold" : "Awaiting approval"}</span></td>
              <td>{n.length ? n.map((x) => byId.get(x.dealId)?.company).filter(Boolean).join(", ") : "—"}</td>
              <td>{a.length ? a.map((x) => `${byId.get(x.dealId)?.company ?? ""}: ₹${Number(x.amountCr)} Cr (${x.status})`).join(" · ") : "—"}</td></tr>); })}
        </tbody></table></div>
          : <div className="chart"><p>No clients yet. Send your office&apos;s invite link (under Team) to the people you advise; when they register through it, they appear here.</p></div>}
        <p className="fine">Totals: {cAsks.filter((x) => x.status !== "Withdrawn").reduce((t, x) => t + Number(x.amountCr), 0).toLocaleString("en-IN")} Cr requested, {cAsks.filter((x) => x.status === "Allotted").reduce((t, x) => t + Number(x.amountCr), 0).toLocaleString("en-IN")} Cr allotted. Your terms with the desk are agreed separately.</p>
      </section>}

      <section className="panel" data-panel="Portfolio" hidden>
        {holdings.length ? <>
          <div className="pf-sum">
            <div><span className="k">Invested</span><b>{crore(pfCost)}</b><small>{holdings.length} {holdings.length === 1 ? "holding" : "holdings"}</small></div>
            <div><span className="k">Marked value</span><b>{pfMarked ? crore(pfValue) : "—"}</b><small>{pfMarked ? `${pfMarked} of ${holdings.length} priced · ${(pfValue / pfMarkedCost).toFixed(2)}x on those` : "Valued once a company lists"}</small></div>
            <div><span className="k">Next step</span><b>{pfNext ? pfNext.step : "—"}</b><small>{pfNext ? pfNext.company : "All holdings listed"}</small></div>
          </div>
          <div className="pf-list">{holdings.map(({ a, d, h }) => (
            <article className="chart pf-card" key={a.id}>
              <div className="pf-head"><div><span className="k">{d?.category}</span><h3>{d?.company}</h3></div>
                <a className="btn sm" href={`/room/${d?.slug}`}>Room and updates</a></div>
              <div className="pf-kv">
                <div><span>Invested</span><b>{crore(h.costRs)}</b><small>{h.shares ? `${h.shares.toLocaleString("en-IN")} shares at ₹${h.price}` : `₹${Number(a.amountCr)} Cr allotted`}{a.allottedAt ? ` · ${fmtDay(a.allottedAt)}` : ""}</small></div>
                <div><span>{h.value ? "Value now" : h.band ? "At the top of the price band" : "Value"}</span>
                  <b>{h.value ? crore(h.value.rs) : h.band ? crore(h.band.rs) : "Once it lists"}{h.value || h.band ? <em className={(h.value ?? h.band)!.multiple >= 1 ? "up" : "down"}> {(h.value ?? h.band)!.multiple.toFixed(2)}x</em> : null}</b>
                  <small>{h.value ? `At ${h.value.basis}` : h.band ? `At ₹${h.band.upper} a share, before listing` : `Target listing ${d?.listingLabel}${d?.listingNote ? `, ${d.listingNote}` : ""}`}</small></div>
                <div><span>Lock-in</span><b>{h.lockIn.ends ? fmtDay(h.lockIn.ends) : "Six months"}</b><small>{h.lockIn.text}</small></div>
              </div>
              <ol className="pf-road" aria-label="Road to listing">{h.steps.map((st) => (
                <li key={st.label} className={st.done ? "done" : st.now ? "now" : ""}><i aria-hidden="true" /><b>{st.label}</b><small>{st.date ? fmtDay(st.date) : st.now ? "Next" : ""}</small></li>))}</ol>
              {d?.ipo.priceBand && !h.listed && <p className="fine">Price band {d.ipo.priceBand}.</p>}
              {d?.ipo.note && <p className="pf-note">{d.ipo.note}</p>}
            </article>))}</div>
          <p className="fine">Values are indicative, at the prices shown, before taxes and costs. Shares held before an IPO stay locked in for six months from the IPO allotment.</p>
        </>
          : <div className="chart"><span className="k">Holdings</span><p>Nothing allotted yet. Once shares are credited to your demat, each holding appears here with its road to listing, lock-in date and value.</p></div>}
      </section>

      <section className="panel" data-panel="Profile" hidden>
        <div className="panel-head"><div><h2>Investment profile</h2><p className="fine">What your office looks for. The desk uses it to bring you the right companies, and the shelf marks the deals that fit. Seen only by your office and the desk.</p></div>
          <div className="ph-meter"><b>{prof.pct}%</b><small>complete</small></div></div>
        <form className="form profform" method="post" action="/api/office/profile">
          <input type="hidden" name="mode" value="full" />
          <fieldset disabled={!canCommit}>
          <div className="pf-card"><span className="k">The office</span>
            <div className="row3">
              <label>City<input name="city" maxLength={80} defaultValue={office.city || ""} placeholder="Mumbai" /></label>
              <label>Website<input name="website" maxLength={200} defaultValue={office.website || ""} placeholder="shahfamilyoffice.in" /></label>
              <label>Invests as<select name="category" defaultValue={office.category || ""}><option value="" disabled>Select</option>{CATEGORY.map((x) => <option key={x}>{x}</option>)}</select></label>
            </div>
            <div className="row3">
              <label>Residency<select name="residency" defaultValue={office.residency || ""}><option value="" disabled>Select</option>{RESIDENCY.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label>Assets under management<select name="aum" defaultValue={office.aum || ""}><option value="">Select</option>{AUM.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label>Typical ticket per deal<select name="ticket" defaultValue={office.ticket || ""}><option value="" disabled>Select</option>{TICKET.map((x) => <option key={x}>{x}</option>)}</select></label>
            </div>
          </div>
          <div className="pf-card"><span className="k">Your thesis</span>
            <label className="pf-l">Sectors you invest in</label>
            <div className="chips">{SECTORS.map(([n]) => <label key={n} className="chipbox"><input type="checkbox" name="sectors" value={n} defaultChecked={(office.sectors || []).includes(n)} /><span>{n}</span></label>)}</div>
            <label className="pf-l">Deal structures</label>
            <div className="chips">{STRUCTURES.map((n) => <label key={n} className="chipbox"><input type="checkbox" name="structures" value={n} defaultChecked={(office.structures || []).includes(n)} /><span>{n}</span></label>)}</div>
            <div className="row3">
              <label>Holding horizon<select name="horizon" defaultValue={office.horizon || ""}><option value="">Select</option>{HORIZON.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label className="chk" style={{ alignSelf: "end" }}><input type="checkbox" name="coLead" defaultChecked={office.coLead} /> Open to co-leading a round</label>
            </div>
            <label>Investment thesis, in your words<textarea name="thesis" rows={4} maxLength={1500} defaultValue={office.thesis || ""} placeholder="e.g. Profitable manufacturers with export revenue, entering 2–3 years before a main-board listing, at a clear discount to listed peers. We avoid lending businesses and anything pre-profit." /></label>
          </div>
          {canCommit ? <div><button className="btn primary" type="submit">Save profile</button>{office.profileAt && <span className="fine" style={{ marginLeft: 10 }}>Last saved {fmtD(office.profileAt)}</span>}</div>
            : <p className="fine">Only people with commit rights can change the profile.</p>}
          </fieldset>
        </form>
        <div className="two" style={{ marginTop: 16 }}>
          <div className="chart"><span className="k">How signing works</span>
            <p className="fine" style={{ marginTop: 6 }}>Each company&apos;s NDA is signed with the signatory&apos;s name and a one-time code emailed to them. No PAN or ID is needed to look at deals; KYC for the investing entity comes only when your office invests.</p>
          </div>
          <div className="chart"><span className="k">Consents and your data</span>
            <form method="post" action="/api/office/consents" style={{ display: "grid", gap: 8 }}>
              <label className="chk"><input type="checkbox" name="email" defaultChecked={office.consents?.email !== false} /> Deal alerts by email</label>
              <label className="chk"><input type="checkbox" name="wa" defaultChecked={!!office.consents?.wa} /> WhatsApp messages about deals</label>
              <label className="chk"><input type="checkbox" name="calls" defaultChecked={!!office.consents?.calls} /> Calls from the desk</label>
              <div><button className="btn sm" type="submit">Save consents</button></div>
            </form>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <a className="btn sm" href="/api/office/export">Download my data</a>
              <form method="post" action="/api/office/deletion"><button className="btn sm ghost" type="submit">Request deletion</button></form>
            </div>
            <p className="fine">Grievance officer and data-protection contact: {GRIEVANCE.name}, <a href={`mailto:${GRIEVANCE.email}`}>{GRIEVANCE.email}</a>.</p>
          </div>
        </div>
      </section>

      <section className="panel" data-panel="Support" hidden>
        <div className="panel-head"><div><h2 className="tt">Help and support.<span className="tt2">Raise a ticket; the desk replies right here.</span></h2>
          <p className="fine">Every ticket gets a number and stays on your office&apos;s record. You are told under the bell and by email when the desk replies.</p></div></div>
        <div className="sp-grid">
          <form className="form sp-form" method="post" action="/api/tickets" data-api="">
            <span className="k">Raise a ticket</span>
            <label>What is it about?<select name="category" required defaultValue={CATEGORIES.some((c) => c.id === tCat) ? tCat : ""} data-sp-cat="">
              <option value="" disabled>Select</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
            <label>Company (optional)<select name="deal" defaultValue={tDeal && deals.some((d) => d.slug === tDeal) ? tDeal : ""}>
              <option value="">Not about one company</option>{deals.map((d) => <option key={d.id} value={d.slug}>{names ? d.company : d.title}</option>)}</select></label>
            <div className="sp-help" data-sp-help="" hidden />
            <label>Subject<input name="subject" required minLength={4} maxLength={160} placeholder="e.g. Code email not arriving" /></label>
            <label>Details<textarea name="body" required minLength={10} rows={5} maxLength={5000} placeholder="What happened, and what you need from the desk. Add links to screenshots or files if useful." /></label>
            <div><button className="btn primary" type="submit">Raise ticket</button></div>
            <script type="application/json" data-sp-hints="" dangerouslySetInnerHTML={{ __html: JSON.stringify(Object.fromEntries(CATEGORIES.map((c) => [c.id, c.help]))).replace(/</g, "\\u003c") }} />
          </form>
          <div className="sp-list">
            <span className="k">Your office&apos;s tickets</span>
            {myTickets.length ? <ul className="tk-list">{myTickets.map((t) => (
              <li key={t.id}><a href={`/support/${ticketNo(t.id)}`}>
                <span className="tk-top"><span className="mono">{ticketNo(t.id)}</span><span className={`pill ${STATUS[t.status]?.pill ?? ""}`}>{STATUS[t.status]?.office ?? t.status}</span></span>
                <b>{t.subject}</b>
                <small>{catLabel(t.category)}{t.dealId && byId.get(t.dealId) ? ` · ${byId.get(t.dealId)!.company}` : ""} · {userName.get(t.userId) ?? ""} · updated {fmtD(t.updatedAt)}</small></a></li>))}</ul>
              : <p className="fine">No tickets yet. Anything you need from the desk, raise it here and it stays on record.</p>}
            <p className="fine sp-alt">Prefer email? <a href={`mailto:${DESK_EMAIL}`}>{DESK_EMAIL}</a> also reaches the desk.</p>
          </div>
        </div>
      </section>

      <section className="panel" data-panel="Team" hidden>
        {introducer?.investorType === "broker" && <p className="notice">Your office was introduced by <b>{introducer.name}</b>. They see which companies you sign NDAs for and the allocations you request, not your documents, questions or notes. To change this, <a href="/dashboard?cat=other#Support">raise a ticket</a>.</p>}
        <div className="panel-head"><div><h2>Team</h2><p className="fine">Everyone from your office on the desk. Each deal&apos;s NDA covers your office&apos;s team for that deal, and every view is logged against a name.</p></div></div>
        <div className="chart">
          <div className="cmpwrap"><table className="cmp plain" style={{ minWidth: 0 }}><thead><tr><th>Name</th><th>Role</th><th>Rights</th></tr></thead><tbody>
            {team.map((t) => <tr key={t.id}><th scope="row">{t.name}<br /><small className="fine">{t.email}</small></th><td>{t.officeRole || "—"}</td><td>{t.rights}</td></tr>)}
            {pending.map((p) => <tr key={`i${p.id}`}><th scope="row">{p.email}</th><td>Invited</td><td>{p.rights}</td></tr>)}
          </tbody></table></div>
          {canCommit && <form className="form" method="post" action="/api/office/invite" style={{ marginTop: 10 }}>
            <div className="row"><label>Email<input type="email" name="email" required placeholder="name@office.in" /></label>
              <label>Rights<select name="rights" defaultValue="View"><option>View</option><option>View, comment</option><option>View, comment, commit</option></select></label></div>
            <div><button className="btn" type="submit">Add a person</button></div>
            <p className="fine">They join your office when they register with this email.</p>
          </form>}
        </div>
        {names && <div className="chart ref-card" id="refer"><span className="k">Refer a family office</span>
          <p className="fine">Know a family office that should see these companies? {st.referrals ? "Your referral is approved the moment they register." : "The desk approves them after they register."} Up to five every 30 days.</p>
          <form method="post" action="/api/office/refer" className="form"><div className="row3"><label>Name<input name="name" required maxLength={120} /></label><label>Email<input name="email" type="email" required maxLength={200} /></label><label>Family office<input name="officeName" maxLength={160} /></label></div>
            <div><button className="btn" type="submit">Make a referral link</button></div></form>
          {refCode && (() => { const url = `${SITE_URL}/register?ref=${refCode}`; const text = `I use Before the Bell to see pre-IPO companies before they list. Register here: ${url}`; return (
            <div className="ref-own"><span className="k">Or share your office&apos;s link</span>
              <p className="fine">Anyone who registers through it is noted as referred by {office.name}.{referredCount ? ` ${referredCount} office${referredCount === 1 ? " has" : "s have"} so far.` : ""}</p>
              <div className="dl-acts"><input readOnly value={url} aria-label="Your office's invite link" /><button type="button" className="btn sm" data-copy={url}>Copy</button><a className="btn sm" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener">WhatsApp</a></div>
            </div>); })()}
          {refs.length > 0 && <ul className="feed ref-list">{refs.map((r) => { const url = `${SITE_URL}/invite/${r.token}`; const text = `${(r.name || "").split(" ")[0]}, I use Before the Bell to see pre-IPO companies before they list. Register here: ${url}`; return (
            <li key={r.id}><b>{r.officeName || r.name}</b> · {r.usedAt ? <span className="pill ok">Registered</span> : <span className="pill">Not yet</span>}
              {!r.usedAt && <div className="dl-acts"><input readOnly value={url} aria-label={`Referral link for ${r.name}`} /><button type="button" className="btn sm" data-copy={url}>Copy</button><a className="btn sm" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener">WhatsApp</a></div>}</li>); })}</ul>}
        </div>}
        <div style={{ marginTop: 12 }}><form method="post" action="/api/auth/signout-all"><button className="btn sm ghost" type="submit">Sign out other devices</button></form></div>
      </section>

      <section className="panel" data-panel="Log" hidden>
        <div className="cmpwrap"><table className="cmp"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>
          {log.map((l) => <tr key={l.id}><td>{fmtT(l.at)}</td><td>{l.who || "—"}</td><td>{l.action}</td></tr>)}
        </tbody></table></div>
        <p className="fine">The log shows the desk offered each deal only to identified people, which is what the private placement rules require.</p>
      </section>
      </div>
      {welcome && (
        <dialog className="welcome" id="welcome" data-key={`omd_welcome_${office.id}`}>
          <form method="dialog" className="wl-x"><button className="btn sm ghost" aria-label="Close">✕</button></form>
          <span className="eyebrow live">You&apos;re in</span>
          <h2>Your office is approved</h2>
          <p>Every company on the desk is now open to you by name, with its pitch deck. When one interests you, sign its NDA on screen and its room opens with the numbers, the documents and the Q&amp;A.</p>
          {promises.length > 0 && <ul className="ticks wl-prom" aria-label="What the desk commits to">{promises.slice(0, 3).map((p) => <li key={p.title}>{p.title}</li>)}</ul>}
          {profileGaps.length > 0 && (
            <form className="form wl-profile" method="post" action="/api/office/profile">
              <span className="k">First, two details for the desk</span>
              <div className="row">
                {!office.category && <label>The office invests as<select name="category" required defaultValue=""><option value="" disabled>Select</option><option>Individual</option><option>HUF</option><option>Private company</option><option>LLP</option><option>Trust</option><option>Family-office AIF</option><option>Other</option></select></label>}
                {!office.residency && <label>Residency<select name="residency" required defaultValue=""><option value="" disabled>Select</option><option>Resident in India</option><option>Non-resident (FEMA route applies)</option></select></label>}
                {!office.ticket && <label>Typical ticket per deal<select name="ticket" required defaultValue=""><option value="" disabled>Select</option><option>₹50 lakh – 1 crore</option><option>₹1–2 crore</option><option>₹2–5 crore</option><option>₹5–25 crore</option><option>Above ₹25 crore</option></select></label>}
              </div>
              <div><button className="btn" type="submit">Save</button></div>
            </form>
          )}
          <span className="k">Highest Desk Scores on the shelf</span>
          <ul className="roomlist">{[...deals].filter((d) => d.open).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3).map((d) => (
            <li key={d.id}><div><b>{d.company}</b><small>{d.category}{d.score != null ? ` · Desk Score ${d.score.toFixed(1)}` : ""}</small></div>{deckDeals.has(d.id) ? <a className="btn sm primary" href={`/deals/${d.slug}#deck`}>Pitch deck</a> : <a className="btn sm primary" href={`/deals/${d.slug}#sign`}>Sign NDA</a>}</li>))}</ul>
          <p className="fine" style={{ marginTop: 12 }}>Tell the desk what you look for in <a href="#Profile" data-close-welcome="">your investment profile</a> and the shelf will mark the deals that fit.</p>
          <form method="dialog"><button className="btn ghost sm">I&apos;ll look around first</button></form>
        </dialog>
      )}
    </div></div>
    <DeckPanel />
    {aiOn && <Analyst deal={null} starters={starters(null)} who={user.name} />}
    </main>
  );
}
