#!/usr/bin/env python3
"""v20: operator becomes SintraCap Advisors LLP; About us rebuilt from sintracap.in with past transactions.
Run from the repo root on the v19 build."""
import re, glob

FILES = sorted(glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('*/*/*.html'))
ADDR = "B/3501, World View, Lodha World Towers, S.B. Marg, Lower Parel, Mumbai 400013"
ENT = "SintraCap Advisors LLP"
LLPIN = "LLPIN ACL-6334"

REPL = [
    ("operated by ABC Private Limited · CIN [to be added] · Registered office: [to be added], Mumbai",
     f"operated by {ENT} · {LLPIN} · Registered office: {ADDR}"),
    ("Pehla Round is operated by ABC Private Limited, CIN [to be added], [registered office to be added].",
     f"Pehla Round is operated by {ENT} ({LLPIN}), {ADDR}."),
    ("It is a deal desk operated by ABC Private Limited, promoted by a family office.",
     f"It is a deal desk operated by {ENT}, part of the SintraCap family office."),
    ("Grievance officer and data-protection contact: [name to be added], desk@pehlaround.in.",
     "Grievance officer and data-protection contact: Pratik Saraogi, Designated Partner, desk@pehlaround.in."),
    ("ABC Private Limited", ENT),
]

for f in FILES:
    h = open(f).read()
    for a, b in REPL: h = h.replace(a, b)
    open(f, 'w').write(h)

# ---------------------------------------------------------------- About us
MGMT = [
    ("ramesh", "Ramesh Saraogi", "Chairman",
     "In the ring since the 1980s. Four decades in Indian capital markets and proprietary investing, through every cycle the market has produced. His proprietary book, Navratri Shares, spans several bulk and large block deals."),
    ("pratik", "Pratik Saraogi", "Managing Partner",
     "Fifteen years across Indian capital markets, structured finance and industrial real estate. Earlier co-founded and ran a consumer technology company to over a million users. Leads the firm's investment banking and its warehousing partnership."),
]
TEAM = [("raghav", "Raghav Kedia", "Director, Capital Markets"), ("kamlesh", "Kamlesh Jain", "Vice President, Warehousing"),
        (None, "Ravindra Bang", "Chartered Accountant"), ("nitin", "Nitin Gandhi", "Chartered Accountant · Diligence and Assurance"),
        ("puneet", "Puneet Shah", "Vice President, Investment Banking"), ("himanshu", "Himanshu Shukla", "Technology and Product"),
        ("vinod", "Vinod Vyas", "Chief of Staff")]
TX = [("Ruparel Realty", "Debt", "Structured debt"), ("Prime Phase Developers", "Warehousing", "Logistics park, land and development"),
      ("Suraj Estate Developers Ltd.", "Equity capital markets", "Follow-on public offer"), ("Rishab World", "Equity capital markets", "Initial public offer"),
      ("Antriksh Group", "Warehousing", "Logistics park, land and development"), ("Dinesh Roadlines", "Warehousing", "Logistics park"),
      ("Vardhman Realty", "Warehousing", "Logistics park"), ("Vascon Engineers Ltd.", "Equity capital markets", "Preferential allotment"),
      ("Sennes Fashion", "Debt", "Term loan, sole arranger"), ("Armsoftech", "Debt", "Receivables financing line, sole arranger"),
      ("Pune E-Stock Broking Ltd.", "Equity capital markets", "Preferential allotment and secondary"), ("AVG Logistics Ltd.", "Equity capital markets", "Equity investment"),
      ("Share India Securities Ltd.", "Equity capital markets", "Bulk deal"), ("Vendolite", "Equity capital markets", "Pre-IPO round"),
      ("AK Specialty Gas", "Equity capital markets", "Pre-IPO round")]

def ini(n): return ''.join(w[0] for w in n.split()[:2])
def portrait(slug, name):
    img = f'<img src="img/{slug}.jpg" alt="{name}" loading="lazy">' if slug else ''
    return f'<div class="ab-pt"><span>{ini(name)}</span>{img}</div>'

mg = ''.join(f'<div class="ab-ld">{portrait(s, n)}<div><span class="eyebrow">{r}</span><h3>{n}</h3><p>{b}</p></div></div>' for s, n, r, b in MGMT)
tm = ''.join(f'<div class="ab-tm">{portrait(s, n)}<b>{n}</b><span>{r}</span></div>' for s, n, r in TEAM)
groups = ["Equity capital markets", "Debt", "Warehousing"]
tx = ''.join(
    f'<div class="ab-txg"><span class="eyebrow">{g}</span><ul>' +
    ''.join(f'<li><b>{n}</b><span>{s}</span></li>' for n, t, s in TX if t == g) + '</ul></div>' for g in groups)

ABOUT = (
 '<main><div class="wrap phead"><span class="eyebrow">About us</span><h1>Who runs the desk</h1>'
 '<p>Pehla Round is run by SintraCap, a family office built on the family\'s own balance sheet. SintraCap invests its own capital in listed and pre-IPO companies, raises capital for promoters, and has built warehousing in the Bhiwandi corridor for the last fifteen years.</p></div>'
 '<section class="sec tight"><div class="wrap">'
 '<div class="ab-figs"><div><b>40+</b><span>years in Indian capital markets</span></div><div><b>25+</b><span>transactions concluded in the last two years, upwards of ₹2,000 Cr</span></div>'
 '<div><b>20+</b><span>live mandates across capital markets, credit and land</span></div><div><b>537</b><span>acres of logistics parks in Bhiwandi partnered on</span></div></div>'
 f'<h2 class="ab-h">Management</h2><div class="ab-lead">{mg}</div>'
 f'<h2 class="ab-h">Senior team</h2><div class="ab-team">{tm}</div>'
 '<h2 class="ab-h">Past transactions</h2><p class="fine" style="margin-top:-6px">Select transactions since August 2024. "Ltd." marks listed companies.</p>'
 f'<div class="ab-tx">{tx}</div>'
 '</div></section>'
 '<section class="sec tight band"><div class="wrap prose">'
 f'<h2>The legal entity</h2><p>{ENT} · {LLPIN} · GSTIN 27AFNFS1139Q1Z8<br>Registered office: {ADDR}</p>'
 '<h2>What we are, and are not</h2><p>A deal desk that introduces registered family offices to private companies and shareholders, builds the deal room and documents the transaction. Not a stock exchange, trading platform, broker, merchant banker, research analyst or investment adviser, and not registered with SEBI or the RBI. Where a deal needs a registered intermediary, such as a merchant banker for an IPO, the room names it.</p>'
 '<h2>How we are paid, and our conflicts</h2><p>Family offices pay nothing. The company or selling shareholder pays a listing fee when a round goes on the desk and a success fee when it closes; the amount, and whether it is paid in cash or shares, is stated in each room and in the offer letter. The desk puts 5% into every round that subscribes, at the same price and lock-in, and never resells that stake through the desk. Because the desk is paid when rounds close, it has a reason to want them to close; the tracker rules on <a href="diligence.html">How we check</a> are how it limits that conflict.</p>'
 '<h2>For companies</h2><p>The desk takes profitable companies with a stated listing plan that meet five tests: not carried elsewhere, revenue and profit today, demonstrably IPO-bound, entry under 10x earnings, and the promoter keeps the majority. <a href="founders.html">List your company</a>.</p>'
 '<h2>Grievances and data protection</h2><p>Grievance officer and data-protection contact: Pratik Saraogi, Designated Partner, desk@pehlaround.in.</p>'
 '</div></section></main>')

CSS = '''<style id="v20">
.ab-figs{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:0 0 8px}
.ab-figs>div{border:1px solid var(--line,#dde);border-radius:12px;padding:16px}
.ab-figs b{display:block;font-size:30px;line-height:1.1;color:var(--ink,#111)}
.ab-figs span{font-size:13px;color:var(--ink2,#555)}
.ab-h{font-size:24px;margin:44px 0 16px}
.ab-lead{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.ab-ld{display:flex;gap:16px;border:1px solid var(--line,#dde);border-radius:14px;padding:16px;align-items:flex-start}
.ab-ld h3{margin:4px 0 6px;font-size:19px}.ab-ld p{margin:0;font-size:14px;line-height:1.55;color:var(--ink2,#555)}
.ab-ld .ab-pt{width:96px;height:120px;flex:none}
.ab-pt{position:relative;border-radius:10px;overflow:hidden;background:var(--bg2,#eef0f4);display:flex;align-items:center;justify-content:center}
.ab-pt span{font-size:20px;letter-spacing:.06em;color:var(--ink3,#888)}
.ab-pt img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ab-team{display:grid;grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:16px}
.ab-tm .ab-pt{aspect-ratio:4/5;margin-bottom:8px}.ab-tm b{display:block;font-size:15px}.ab-tm span{font-size:12.5px;color:var(--ink2,#555)}
.ab-tx{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.ab-txg{border:1px solid var(--line,#dde);border-radius:14px;padding:16px}
.ab-txg ul{list-style:none;margin:10px 0 0;padding:0}
.ab-txg li{padding:9px 0;border-top:1px solid var(--line,#e5e7eb)}.ab-txg li:first-child{border-top:0}
.ab-txg li b{display:block;font-size:14.5px}.ab-txg li span{font-size:12.5px;color:var(--ink2,#555)}
@media (max-width:820px){.ab-figs{grid-template-columns:1fr 1fr}.ab-lead,.ab-tx{grid-template-columns:1fr}}
@media (max-width:420px){.ab-ld{flex-direction:column}.ab-ld .ab-pt{width:100%;height:auto;aspect-ratio:4/3}}
</style>'''

h = open('about.html').read()
h, n = re.subn(r'<main>.*?</main>', ABOUT, h, count=1, flags=re.S); assert n == 1
h = h.replace('</head>', CSS + '</head>', 1)
open('about.html', 'w').write(h)

left = [f for f in FILES if 'ABC Private' in open(f).read() or 'to be added' in open(f).read()]
print('left placeholders in:', left)
