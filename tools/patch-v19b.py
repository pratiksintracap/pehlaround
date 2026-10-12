#!/usr/bin/env python3
"""v19: apply Puneet's review to the static Pehla Round build. Run from repo root on a clean checkout."""
import re, json, glob, os, sys, html as H

FILES = sorted(glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('*/*/*.html'))
MISS = []

def sub1(s, old, new, label, count=1):
    if old not in s:
        MISS.append(label); return s
    return s.replace(old, new) if count == 0 else s.replace(old, new, count)

def rsub(s, pat, new, label, flags=re.S, count=0):
    s2, n = re.subn(pat, new, s, count=count, flags=flags)
    if n == 0: MISS.append(label)
    return s2

OPERATOR = "ABC Private Limited"

# ---------------------------------------------------------------- deals (public outline data)
DEALS = [
  dict(slug="jewellery-pre-ipo", when='Sept 2028', run='jewellery-pre-ipo', ins='Primary equity, pre-IPO', sector="Jewellery manufacturing and retail", cat="Pre-IPO primary", sample=True,
       hl="Jewellery manufacturer and retailer with an in-house manufacturing technology unit; growing through franchise stores.",
       listing="Sept 2028 (target)", status="Illustrative sample"),
  dict(slug="ai-collections-software", when='Sept 2028', run='ai-collections-software', ins='Primary equity', sector="AI-led collections software", cat="Growth round", sample=True,
       hl="Collections software for lenders. RBI recovery-conduct rules are a listed risk.",
       listing="Sept 2028 (target)", status="Illustrative sample"),
  dict(slug="ethanol-distillery-pre-ipo", when='Jul 2029', run='edible-oils-pre-ipo', ins='Primary equity, pre-IPO', sector="Grain-based ethanol and ENA distillery", cat="Pre-IPO primary", sample=True,
       hl="Grain-based ethanol and extra neutral alcohol. DRHP not yet filed.",
       listing="Jul 2029 (target) · DRHP not filed", status="Illustrative sample"),
  dict(slug="edible-oils-pre-ipo", when='Jul 2029', run='edible-oils-pre-ipo', ins='Primary equity, pre-IPO', sector="Edible oils", cat="Pre-IPO primary", sample=True,
       hl="Trading business consolidated into a public company in 2026. Restated combined financials and a related-party review are pending.",
       listing="Jul 2029 (target)", status="Illustrative sample"),
  dict(slug="naval-defence-secondary", when='Sept 2028', run='naval-defence-secondary', ins='Secondary, pre-IPO', sector="Naval defence services and manufacturing", cat="Pre-IPO secondary", sample=False,
       hl="Tier I supplier to the Ministry of Defence. Secondary sale: the money goes to the selling shareholders, not the company.",
       listing="Company target Sep 2028 · main board", status="Room open to registered offices"),
  dict(slug="waste-management-growth-round", when=None, run=None, ins='Equity and debt', sector="Waste management and composting equipment", cat="Growth round", sample=True, notopen=True,
       hl="Equity alongside debt. No listing scheduled yet, so it does not meet the IPO-bound test and has no room.",
       listing="Not scheduled", status="In diligence · not open"),
]
BY = {d['slug']: d for d in DEALS}

# deal art per slug, lifted from the existing cards
_idx = open('index.html').read()
ART = {}
for m in re.finditer(r'<figure class="deal-art" aria-hidden="true">(.*?)</figure>.*?data-save="([^"]+)"', _idx, re.S):
    ART[m.group(2)] = m.group(1)
RUN = {}
for m in re.finditer(r'data-save="([^"]+)".*?<div class="runway( none)?"[^>]*>(<svg.*?</svg>)', _idx, re.S):
    RUN[m.group(1)] = m.group(3)
SAVE_SVG = re.search(r'<button type="button" class="save"[^>]*>(.*?)</button>', _idx, re.S).group(1)

def stagetxt(d): return 'Not open' if d.get('notopen') else ('Sample' if d['sample'] else 'Live mandate')
def runway(d):
    if d['run']:
        return (f'<div class="runway" aria-label="Target listing {d["when"]}">{RUN[d["run"]]}<div class="k"><span>Today</span>'
                f'<span>Target listing · <b>{d["when"]}</b></span></div></div>')
    return (f'<div class="runway none">{RUN[d["slug"]]}<div class="k"><span>Growth round</span><span>Listing not yet scheduled</span></div></div>')
def dilv(d):
    if d['slug'] == 'naval-defence-secondary':
        return ('<div class="dil" aria-label="Diligence status, visible to everyone"><span class="dots">' +
               '<i class="done"></i>'*3 + '<i class="in-progress"></i>'*2 + '<i class="pending"></i>'*4 + '<i class="in-progress"></i>' +
               '</span><span><b>3/10</b> checks done · <b>6</b> risks flagged</span></div>')
    if d.get('notopen'):
        return '<div class="dil"><span class="fine">Not open: no listing scheduled, so it fails the IPO-bound test.</span></div>'
    return '<div class="dil"><span class="fine">Illustrative sample: no real company or room behind it.</span></div>'
def facts(d, big=True):
    return (f'<dl class="facts"><div><dt>Target listing</dt><dd class="big">{d["when"] or "Not set"}</dd></div><div><dt>Structure</dt><dd>{d["cat"]}</dd></div>'
            f'<div><dt>Status</dt><dd>{d["status"]}</dd></div><div><dt>Desk position</dt><dd>5% at close</dd></div></dl>')
def card(d, pre, i):
    if d['slug'] == 'naval-defence-secondary':
        acts = (f'<div class="acts"><a class="btn primary" href="{pre}room/{d["slug"]}.html"><span class="lock">Unlock room</span></a>'
                f'<a class="btn" href="{pre}deals/{d["slug"]}.html">Outline</a></div>')
    elif d.get('notopen'):
        acts = f'<div class="acts"><span class="btn" aria-disabled="true">Not open</span><a class="btn" href="{pre}deals/{d["slug"]}.html">Outline</a></div>'
    else:
        acts = f'<div class="acts"><a class="btn primary" href="{pre}deals/{d["slug"]}.html">View sample outline</a></div>'
    return (f'<article class="card rv inview" style="--d:{i*0.06:.2f}s" data-cat="{d["cat"]}">'
            f'<div style="position:relative"><figure class="deal-art" aria-hidden="true">{ART.get(d["slug"],"")}</figure>'
            f'<span class="tag">{d["cat"]}</span><span class="tag stage">{stagetxt(d)}</span>'
            f'<button type="button" class="save" data-save="{d["slug"]}" aria-pressed="false" aria-label="Save to shortlist" title="Save to shortlist">{SAVE_SVG}</button></div>'
            f'<div class="body"><h3><a href="{pre}deals/{d["slug"]}.html">{d["sector"]}</a></h3><p class="hl">{d["hl"]}</p>'
            f'{facts(d)}{runway(d)}<p class="deskpct"><i></i> Desk invests 5% of this round at close, same terms</p>{dilv(d)}{acts}</div></article>')

def shelf(pre):
    return '<div class="shelf">' + ''.join(card(d, pre, i) for i, d in enumerate(DEALS)) + '</div>'

UD_DATA = json.dumps([dict(slug=d['slug'], sector=d['sector'], category=d['cat'], listing=d['listing'], status=d['status'],
                           sample=d['sample']) for d in DEALS], ensure_ascii=False)

# ---------------------------------------------------------------- header / footer
CUR = " aria-current=\"page\""
NAV = [("deals.html", "Deals"), ("how-it-works.html", "How it works"), ("diligence.html", "How we check"),
       ("about.html", "About us"), ("founders.html", "List your company")]

def header(pre, cur, old):
    icons = re.search(r'<div class="acts">(<button type="button" class="iconbtn" id="shortlist-btn".*?id="theme-btn".*?</button>)', old, re.S).group(1)
    menu_svg = re.search(r'<button type="button" class="mnav-btn"[^>]*>(.*?)</button>', old, re.S).group(1)
    nav = ''.join(f'<a href="{pre}{h}"{CUR if h == cur else ""}>{t}</a>' for h, t in NAV)
    mnav = ''.join(f'<a href="{pre}{h}">{t}</a>' for h, t in NAV) + f'<a href="{pre}register.html">Sign in</a><a href="{pre}register.html">Register</a>'
    return (f'<header class="hdr"><div class="wrap in"><a class="logo" aria-label="Pehla Round home" href="{pre}index.html"><span class="mk" aria-hidden="true">1</span>Pehla Round</a>'
            f'<nav aria-label="Main">{nav}</nav><div class="acts">{icons}'
            f'<a class="btn ghost sm hide-xs" href="{pre}register.html">Sign in</a><a class="btn primary sm hide-xs" href="{pre}register.html">Register</a>'
            f'<div class="mnav"><button type="button" class="mnav-btn" aria-expanded="false" aria-controls="mnav-panel" aria-label="Open menu">{menu_svg}</button>'
            f'<div id="mnav-panel" role="navigation" class="mnav-panel" aria-label="Site">{mnav}</div></div></div></div></header>')

def footer(pre):
    links = ''.join(f'<a href="{pre}{h}">{t}</a>' for h, t in NAV) + f'<a href="{pre}legal.html">Terms, privacy and disclosures</a>'
    return (f'<footer><div class="wrap"><div class="in"><div><strong style="color:var(--ink)">Pehla Round</strong> · '
            f'operated by {OPERATOR} · CIN [to be added] · Registered office: [to be added], Mumbai · desk@pehlaround.in</div>'
            f'<div class="links">{links}</div></div>'
            f'<p class="disc">Pehla Round is a deal desk. It is not a stock exchange, trading platform, broker, merchant banker or investment adviser, and is not registered with SEBI. '
            f'Nothing on this website is an offer or invitation to subscribe for or buy securities. Any offer is made privately, only to identified family offices, through a private placement offer letter or a share purchase agreement under the Companies Act, 2013. '
            f'Deal outlines on this site are anonymised, and all but one are illustrative samples. Investments in unlisted companies are illiquid, may not list on the expected timeline or at all, and can lose their entire value. '
            f'The desk charges family offices nothing. It is paid a fee by the company or selling shareholder, and puts 5% into each round that subscribes, on the same price and lock-in; both are stated in each deal room. '
            f'Grievance and data-protection contact: desk@pehlaround.in. <a href="#" data-show-disclaimer>Read the site disclaimer again</a>.</p></div></footer>')

# ---------------------------------------------------------------- disclaimer + extra CSS/JS
DISC_VER = "2026-10-12"
DISCLAIMER = f'''<div id="disc-gate" class="discgate" role="dialog" aria-modal="true" aria-labelledby="disc-h" hidden><div class="disc-card">
<h2 id="disc-h">Important information. Please read before continuing.</h2>
<div class="disc-body">
<p><b>Who we are.</b> Pehla Round is operated by {OPERATOR}, CIN [to be added], [registered office to be added]. We are a deal desk that introduces family offices to private companies raising capital. We are not a stock exchange, trading platform, broker, merchant banker or investment adviser, and we are not registered with SEBI.</p>
<p><b>No offer.</b> Nothing on this website is an offer or invitation to subscribe for or buy securities. Any offer is made privately, only to identified family offices, through a private placement offer letter under the Companies Act, 2013.</p>
<p><b>Information.</b> Company information is provided by the companies and checked by the desk on a best-effort basis from the sources stated. It may contain errors or omissions, and projections may not be achieved.</p>
<p><b>No advice.</b> We do not give investment, legal or tax advice or recommendations. Each family office decides on the documents and its own advisers.</p>
<p><b>Risk.</b> Investments in unlisted companies are illiquid, may not list on the expected timeline or at all, and can lose their entire value.</p>
<p><b>How we are paid.</b> The company or selling shareholder pays the desk a fee, and the desk invests 5% of each round that subscribes, on the same terms as investors. Both are disclosed in each deal room.</p>
<p><b>Eligibility.</b> This site is for family offices and their authorised representatives only.</p>
</div>
<div class="disc-acts"><button type="button" class="btn primary" id="disc-agree">I have read and agree</button><button type="button" class="btn" id="disc-leave">Leave site</button></div>
<p class="fine">Draft for counsel to finalise · version {DISC_VER}</p>
</div></div>'''

EXTRA_CSS = '''<style id="v19">
[hidden]{display:none!important}
.discgate{position:fixed;inset:0;z-index:1000;background:rgba(8,14,30,.72);display:flex;align-items:center;justify-content:center;padding:16px}
.disc-card{background:var(--bg,#fff);color:var(--ink,#111);max-width:640px;width:100%;max-height:calc(100vh - 32px);overflow-y:auto;border-radius:14px;padding:22px 22px 16px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.disc-card h2{font-size:19px;margin:0 0 12px;line-height:1.3}
.disc-body p{font-size:14px;line-height:1.55;margin:0 0 10px;overflow-wrap:anywhere}
.disc-acts{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 8px}
body.disc-open{overflow:hidden}
.tag.stage.sample{background:var(--bg2,#eef0f4);color:var(--ink2,#444)}
.tag.stage.liveroom{background:var(--live,#1f9d6b);color:#fff}
.facts.fixed{grid-template-columns:1fr!important}
.facts.fixed>div{display:flex;justify-content:space-between;gap:12px}
.facts.fixed dd{text-align:right}
.btn[aria-disabled=true]{opacity:.55;cursor:not-allowed}
.mnav-btn[aria-expanded=true] svg{display:none}
.mnav-btn[aria-expanded=true]::before{content:"\\00d7";font-size:26px;line-height:1}
.callbox{border:1px solid var(--line,#dde);border-radius:12px;padding:16px;margin-top:18px}
.callbox .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.statusrail{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 0;padding:0;list-style:none}
.statusrail li{font-size:12.5px;padding:5px 10px;border-radius:99px;border:1px solid var(--line,#dde)}
.statusrail li.done{background:var(--live,#1f9d6b);color:#fff;border-color:transparent}
.statusrail li.now{border-color:var(--live,#1f9d6b);font-weight:600}
.notice{font-size:12.5px;line-height:1.5;color:var(--ink2,#555);border-left:3px solid var(--live,#1f9d6b);padding:8px 12px;background:var(--bg2,#f4f6f8);border-radius:6px}
.people{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.people>div{border:1px solid var(--line,#dde);border-radius:12px;padding:16px}
@media (max-width:640px){.callbox .row{grid-template-columns:1fr}}
@media (max-width:420px){.hide-xs{display:none!important}}
</style>'''

EXTRA_JS = '''<script>
(function(){
  var VER="''' + DISC_VER + '''", KEY="pr_disclaimer", g=document.getElementById("disc-gate");
  function get(){try{return JSON.parse(localStorage.getItem(KEY)||"null");}catch(e){return null;}}
  function set(v){try{localStorage.setItem(KEY,JSON.stringify(v));}catch(e){}}
  function show(){if(!g)return;g.hidden=false;document.body.classList.add("disc-open");var a=document.getElementById("disc-agree");if(a)a.focus({preventScroll:true});var c=g.querySelector(".disc-card");if(c)c.scrollTop=0;}
  function hide(){if(!g)return;g.hidden=true;document.body.classList.remove("disc-open");}
  var rec=get(), fresh=rec&&rec.v===VER&&(Date.now()-rec.at)<30*864e5;
  if(!fresh) show();
  var a=document.getElementById("disc-agree"); if(a) a.addEventListener("click",function(){
    // acceptance is logged with time and text version; the live product writes this to the office's audit trail
    set({v:VER,at:Date.now()}); hide();});
  var l=document.getElementById("disc-leave"); if(l) l.addEventListener("click",function(){
    if(history.length>1) history.back(); else location.replace("about:blank");});
  document.querySelectorAll("[data-show-disclaimer]").forEach(function(x){x.addEventListener("click",function(e){e.preventDefault();show();});});
  if(g) g.addEventListener("keydown",function(e){ if(e.key==="Tab"){var f=g.querySelectorAll("button");if(!f.length)return;var first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  // every view starts at the top unless it targets an anchor
  try{if("scrollRestoration" in history) history.scrollRestoration="manual";}catch(e){}
  if(!location.hash) window.scrollTo(0,0);
  // request a management call (deal room)
  var cf=document.getElementById("callform"); if(cf) cf.addEventListener("submit",function(e){e.preventDefault(); if(!cf.reportValidity())return;
    var b=cf.querySelector("button[type=submit]"); b.disabled=true; b.textContent="Requested";
    var ok=cf.querySelector(".ok"); if(ok){ok.classList.add("show");ok.textContent="Requested. The desk proposes a group slot with the company and posts the written summary to this room for every registered office.";}},true);
  // registration: show the status rail after submit
  var rr=document.getElementById("regrail"); if(rr&&/register/.test(location.pathname)){var f=document.querySelector("form.form");
    if(f) f.addEventListener("submit",function(){ if(f.checkValidity()){ var li=rr.querySelectorAll("li"); li[0].className="done"; li[1].className="now"; }},true);}
})();
</script>'''

# ---------------------------------------------------------------- scripts shared by every page
_sc = re.findall(r'<script>(.*?)</script>', _idx, re.S)
SC0, SC1 = _sc[0], _sc[1]
SC1n = SC1
SC1n = rsub(SC1n, r'var ROWS = \[.*?\];', '''var ROWS = [
      ["Structure", function (d) { return d.category; }],
      ["Target listing", function (d) { return d.listing; }],
      ["Status", function (d) { return d.status; }],
      ["Desk position", function () { return "5% if the round subscribes, same price and lock-in"; }]
    ];''', 'compare rows')
SC1n = SC1n.replace('a.textContent = "Open deal room"', 'a.textContent = "Unlock room"')
SC0n = SC0.replace("A banker from the desk will call within two working days.", "The desk will reply by email within two working days.")
SC0n = SC0n.replace("Registered. Next: sign the confidentiality undertaking.", "Registered. Next: PAN check and the e-signed confidentiality undertaking.")

# ---------------------------------------------------------------- global copy fixes (every page)
GLOBAL = [
  (" Found only here.", ""), ("Found only here.", ""),
  ("Register your family office", "Register"), ("Register your office", "Register"),
  ("Register to see the schedule", "Register"),
  ("IC memo (one page)", "Deal summary (one page)"), ("IC memo", "Deal summary"),
  ("one-page memo", "one-page deal summary"),
  ("Express interest in one click", "Request an allocation from the room"),
  ("Tell us your amount while the call is fresh. We confirm availability with the promoter and come back within two working days.",
   "Indicate an amount in the room. It is non-binding; a commitment is made only on signed documents after KYC, with a summary of terms and risks to confirm."),
  ("One click-through confidentiality undertaking covers every deal you open on the desk.",
   "One e-signed confidentiality undertaking covers every deal you open on the desk."),
  ("It is a deal desk run by a family office and investment banking team. It does not run a trading platform, pool investor money or give investment advice.",
   f"It is a deal desk operated by {OPERATOR}, promoted by a family office. It is not a broker, merchant banker or investment adviser and is not registered with SEBI; where a deal needs a registered intermediary, the room names it. It does not run a trading platform, pool investor money or give investment advice."),
  ("Most rounds on the desk are ₹10–50 Cr, with family office tickets from ₹50 lakh to ₹5 Cr. Larger allocations and co-lead positions are available on several deals; say so when you express interest.",
   "Each room states its own minimum, usually ₹50 lakh or ₹1 crore. The minimum is set from the round size and the 200-offeree-per-year limit for a private placement, so that a round can fill within the law. Larger allocations can be requested in the room."),
  ("The desk is paid by the company or the selling shareholder: a listing fee when a round goes on the desk and a success fee when it closes, both disclosed in the room.",
   "The desk is paid by the company or the selling shareholder: a listing fee when a round goes on the desk and a success fee when it closes. The amount, and whether it is paid in cash or shares, is stated in each room before you commit."),
  ("The desk takes <!-- -->5<!-- -->% of every round that subscribes, on the same terms.", "The desk puts <!-- -->5<!-- -->% into every round that subscribes, on the same terms."),
  ("and takes 5% of the round itself when it subscribes.", "and puts 5% into the round itself when it subscribes."),
  ("a desk that takes <!-- -->5<!-- -->% of your round itself when it subscribes", "a desk that puts <!-- -->5<!-- -->% into your round itself when it subscribes"),
  ('data-alert="Round passes 60% committed" aria-pressed="false">Round passes 60% committed', 'data-alert="Round size or timetable changes" aria-pressed="false">Round size or timetable changes'),
]

def pre_of(h):
    m = re.search(r'id="root"', h) and re.search(r'data-root="([^"]*)"', h)
    return m.group(1) if m else ''

for f in FILES:
    h = open(f).read()
    pre = pre_of(h)
    cur = f if '/' not in f else ('deals.html' if f.startswith(('deals/', 'room/')) else f)
    old_hdr = re.search(r'<header class="hdr">.*?</header>', h, re.S).group(0)
    h = h.replace(old_hdr, header(pre, cur, old_hdr))
    h = rsub(h, r'<footer><div class="wrap">.*?</footer>', footer(pre), f'{f}: footer')
    for a, b in GLOBAL: h = h.replace(a, b)
    # scripts + data
    h = h.replace(SC0, SC0n).replace(SC1, SC1n)
    h = rsub(h, r'(<script id="ud-data" type="application/json">).*?(</script>)', lambda m: m.group(1) + UD_DATA + m.group(2), f'{f}: ud-data')
    # extra css, disclaimer, js
    h = h.replace('</head>', EXTRA_CSS + '</head>', 1)
    h = h.replace('</body>', DISCLAIMER + EXTRA_JS + '</body>', 1)
    open(f, 'w').write(h)

# ---------------------------------------------------------------- home page
h = open('index.html').read()
h = sub1(h, '<span class="eyebrow live" style="color:var(--live)">6<!-- --> deals open to family offices</span>',
         '<span class="eyebrow live" style="color:var(--live)">Invitation-only · for family offices</span>', 'hero eyebrow')
h = sub1(h, '<h1>Undiscovered, profitable, IPO-bound companies. <em></em></h1>', '<h1>Undiscovered, profitable, IPO-bound companies. <em>Checked before you see them.</em></h1>', 'hero h1')
h = sub1(h, '<p class="lede">Companies no banker has marketed and no other platform has, each found, negotiated and checked by the desk before it is shown, each in a structured deal room that opens the moment you sign the NDA. No call, no analyst.</p>',
         '<p class="lede">Private companies raising their first real round. Registered family offices see each one in the same structured deal room, after an e-signed NDA.</p>', 'hero lede')
h = sub1(h, '<a class="btn onnavy" href="room/naval-defence-secondary.html">See a deal room</a>', '<a class="btn onnavy" href="diligence.html">How we check</a>', 'hero cta2')
# hero mock: realistic illustrative numbers
def bars(m):
    s = m.group(0)
    new = {"Revenue FY25": 82, "PAT FY25": 7, "Revenue FY26": 96, "PAT FY26": 9, "Revenue FY27E": 116, "PAT FY27E": 12}
    k = 186 - 130.3809523809524; k = k / 64
    def one(g):
        t = g.group(0); name = re.search(r'<title>(.*?): ', t).group(1)
        if name not in new: return t
        v = new[name]; hgt = v * k; y = 186 - hgt
        t = re.sub(r'<title>.*?</title>', f'<title>{name}: {v}</title>', t)
        t = re.sub(r'y="[\d.]+" width', f'y="{y:.2f}" width', t, count=1)
        t = re.sub(r'height="[\d.]+"', f'height="{hgt:.2f}"', t, count=1)
        t = re.sub(r'(<text class="tv"[^>]*y=")[\d.]+("[^>]*>)[^<]*', lambda q: f'{q.group(1)}{y-7:.2f}{q.group(2)}{v}', t, count=1)
        return t
    return re.sub(r'<g class="bargrp">.*?</g>', one, s, flags=re.S)
h = rsub(h, r'<div class="mock-chart">.*?</svg>', bars, 'hero chart', count=1)
h = sub1(h, '<div class="mock-kv"><span class="k">P/E FY27E</span><b>8x</b></div><div class="mock-kv"><span class="k">Round</span><b>₹30 Cr</b></div><div class="mock-kv"><span class="k">Ticket</span><b>₹1 Cr+</b></div>',
         '<div class="mock-kv"><span class="k">P/E trailing</span><b>12x</b></div><div class="mock-kv"><span class="k">P/E forward</span><b>9x</b></div><div class="mock-kv"><span class="k">Pre-money</span><b>₹108 Cr</b></div>', 'hero kv')
# feed: Krasny's dated updates only, no duplication, no urgency
h = rsub(h, r'<ul class="feedlist">.*?</ul>', '<ul class="feedlist"><li><span class="mono">6 Oct 2026</span>Naval defence secondary: company states a main-board listing target of September 2028. Added to the IPO path.</li><li><span class="mono">3 Oct 2026</span>Naval defence secondary: mandate holder answered the desk\'s five questions; terms panel updated.</li><li><span class="mono">2 Oct 2026</span>Naval defence secondary: information memorandum received; snapshot and financials updated from it.</li></ul>', 'feed')
h = re.sub(r'(<ul class="feedlist">)(.*?)(</ul>)', lambda m: m.group(1)+m.group(2)*3+m.group(3), h, count=1, flags=re.S)
# niche
h = sub1(h, '<p><b>Exclusive, undiscovered, profitable, IPO-bound companies at under 10x earnings.</b> Found through promoters, CAs and lenders, not decks. Negotiated, diligenced and selected by the desk; most raises it sees never get a room. Nothing on the shelf can be bought anywhere else.</p>',
         '<p><b>Profitable private companies with a stated listing plan, priced on earnings.</b> Found through promoters, CAs and lenders, not decks, and not on other unlisted platforms when they come to the desk. Each is screened against five published tests and the same ten checks; the desk records facts and does not rate or recommend.</p>', 'niche')
# shelf
h = sub1(h, '<span class="eyebrow">The shelf</span><h2>Deals open for interest</h2><p>Shown in outline; every one is exclusive to this desk. Names, valuation, financials and the data room unlock once your office registers and accepts the NDA.</p>',
         '<span class="eyebrow">On the desk, in outline</span><h2>What a registered office sees</h2><p>Anonymised outlines only. Round size, valuation, trailing and forward P/E, the desk\'s fee and the room open after registration, PAN check and the NDA. Five of the six outlines below are illustrative samples; the naval defence secondary is a live mandate.</p>', 'shelf head')
h = sub1(h, '<a class="btn" href="deals.html">All deals</a>', '<a class="btn" href="deals.html">All outlines</a>', 'all deals btn')
h = rsub(h, r'<div class="shelf">.*?</article></div>', shelf(''), 'home shelf', count=1)
# five tests
h = sub1(h, '<span>Entry at a single-digit multiple of earnings, shown as implied P/E in every room, so the listing is the upside, not the entry price.</span>',
         '<span>Entry at a single-digit multiple of earnings. Every room shows pre-money valuation with trailing and forward P/E side by side, so the test can be checked.</span>', 'test pe')
h = sub1(h, '<span>No banker-marketed round, and not carried by any other unlisted or pre-IPO platform. If you can buy it elsewhere, it is not here.</span>',
         '<span>No banker-marketed round, and not carried by other unlisted or pre-IPO platforms when it comes to the desk.</span>', 'test only')
h = sub1(h, 'The desk puts in 5% of every round that subscribes, on the same terms, so it is never only selling.', 'The desk puts 5% into every round that subscribes, on the same terms.', 'test skin')
h = sub1(h, '<p class="fine rv inview" style="margin-top:14px">Most raises the desk sees never get a room. Every room states how the company meets each of the five.',
         '<p class="fine rv inview" style="margin-top:14px">Every room states how the company meets each of the five, with sources.', 'tests fine')
# pflow copy
h = sub1(h, '<p>Office name, who decides, PAN, ticket size. Add your CIO or CA as a viewer. No fee, now or ever.</p>',
         '<p>Step one is name, office, email, mobile and role. PAN, the investing entity and residency come at step two, before any room opens. No fee, now or ever.</p>', 'pflow o1')
h = sub1(h, '<p>A single confidentiality undertaking, typed and timestamped on screen, covers every room you open on the desk, now and later.</p>',
         '<p>A single confidentiality undertaking, e-signed (Aadhaar or DSC) and stamped, covers every room you open on the desk, now and later.</p>', 'pflow o2')
h = sub1(h, '<p>Ask the promoter in writing; answers are posted for every office. Join a small-group session with the founder or CFO. Your CA can come.</p>',
         '<p>Ask the promoter in writing, or request a management call from the room. Calls are group sessions under NDA, and a written summary is posted for every office.</p>', 'pflow o4')
h = sub1(h, '<p>Reserve an allocation and the desk sends the term sheet within two working days. Or pass with a one-line reason; nobody calls to change your mind.</p>',
         '<p>Indicate an amount, then confirm on a summary of terms and risks after KYC; nothing is committed in one click. Or pass with a one-line reason; nobody calls to change your mind.</p>', 'pflow o5')
h = sub1(h, 'Quarterly updates, listing milestones and lock-in dates stay in the office\'s diary.', 'Quarterly updates, listing milestones and lock-in end dates stay in the office\'s dashboard.', 'pflow o6')
h = sub1(h, '<p class="see"><b>What you see:</b> <!-- -->The allocation in your diary, or the pass with its reason.</p>', '<p class="see"><b>What you see:</b> <!-- -->The allocation in your dashboard, or the pass with its reason.</p>', 'pflow o5 see')
# money-flow section
h = sub1(h, '<span class="eyebrow">Run by a family office, for family offices</span><h2>We sit on your side of the table</h2><p>The investment and the shares move between you and the company. The desk builds the room, documents the deal and reports until listing; the company pays for that, the office pays nothing.</p>',
         '<span class="eyebrow">How the money moves</span><h2>Who pays whom</h2><p>The investment and the shares move between you and the company or seller. The company or seller pays the desk a fee, stated in each room; the office pays nothing. That fee is a conflict of interest, which is why the tracker rules above exist.</p>', 'money section')
h = sub1(h, '<div class="rv scrollx inview" style="margin-bottom:24px">', '<div class="rv scrollx moneyflow inview" style="margin-bottom:24px">', 'moneyflow class')
# remove the public diary band
h = sub1(h, 'The desk is paid when you commit, but it is built for the office that looks at forty deals and commits to three.', 'It is built for the office that looks at forty deals and commits to three.', 'diary copy')
h = sub1(h, '<b>Alert · FY26 audit signed; room re-opened</b>', '<b>Alert · FY27 audit signed; room re-opened</b>', 'diary audit')
# FAQ: drop two answers already covered by the tracker rules
h = rsub(h, r'<details><summary>Is the diligence tracker the same for everyone\?</summary>.*?</details>', '', 'faq tracker')
h = rsub(h, r'<details><summary>Do you tell me the bad news\?</summary>.*?</details>', '', 'faq bad news')
h = h.replace('it goes into your office\'s diary.', 'it goes into your office\'s dashboard.')
open('index.html', 'w').write(h)

# ---------------------------------------------------------------- deals page
h = open('deals.html').read()
h = sub1(h, '<span class="eyebrow live">6<!-- --> live · ₹<!-- -->192<!-- --> Cr open</span><h1>Every deal on the desk</h1><p>Shown in outline. Register once to unlock names, valuation, financials, the data room and promoter sessions for every deal.</p>',
         '<span class="eyebrow">Outlines</span><h1>On the desk, in outline</h1><p>Anonymised outlines in one fixed format. Names, round size, valuation, trailing and forward P/E, the desk\'s fee and the data room open to registered family offices after the PAN check and NDA. Five of the six are illustrative samples.</p>', 'deals head')
h = rsub(h, r'<div class="shelf">.*?</article></div>', shelf(''), 'deals shelf', count=1)
h = h.replace("it goes into your office's diary.", "it goes into your office's dashboard.")
open('deals.html', 'w').write(h)

# ---------------------------------------------------------------- outline pages, v18 layout
STAGES = ['Outline', 'Room open', 'Closing']
for d in DEALS:
    f = f'deals/{d["slug"]}.html'; h = open(f).read(); pre = '../'
    now = 'Room open' if d['slug'] == 'naval-defence-secondary' else 'Outline'
    bar = ''.join(f'<li class="{"now" if st == now else ""}">{st}</li>' for st in STAGES)
    if d['slug'] == 'naval-defence-secondary':
        track = ('<p style="color:var(--ink2)"><b>3/10</b> checks done, 3 in progress, 4 pending · as of 11 Oct 2026.</p><ul class="ticks">'
                 '<li>Audit not complete: FY26 figures unaudited and two sources disagree by about 9%.</li>'
                 '<li>Secondary only: no capital goes to the company.</li>'
                 '<li>Customer concentration: revenue almost entirely Ministry of Defence, Navy and Coast Guard.</li>'
                 ''
                 '<li>Consolidated PAT is about 75% higher than standalone.</li>'
                 '<li>Defence is a licensed sector with FDI limits; non-resident offices need the FEMA route confirmed.</li>'
                 '<li>Exit through an IPO offer for sale needs a one-year holding before the DRHP, then a six-month lock-in.</li></ul>')
        cta = f'<a class="btn primary" href="{pre}room/{d["slug"]}.html">Unlock the deal room</a>'
    elif d.get('notopen'):
        track = '<p style="color:var(--ink2)">Not open. With no listing scheduled it does not meet the IPO-bound test, so the desk has not opened a room.</p>'
        cta = '<span class="btn" aria-disabled="true">Not open</span>'
    else:
        track = '<p style="color:var(--ink2)">Illustrative sample. There is no real company, tracker or room behind this outline; it shows the format a registered office sees.</p>'
        cta = f'<a class="btn primary" href="{pre}room/naval-defence-secondary.html">See the live room</a>'
    more = ''.join(f'<li><a href="{pre}deals/{o["slug"]}.html"><span class="s">{o["sector"]}</span><span class="f">{o["cat"]} · {stagetxt(o)}</span></a></li>' for o in DEALS if o is not d)
    main = (f'<main><div class="wrap"><p class="crumb rv inview"><a href="{pre}deals.html">← All outlines</a></p><article class="detail"><div class="rv inview">'
            f'<div style="position:relative"><figure class="deal-art" aria-hidden="true">{ART.get(d["slug"],"")}</figure><span class="tag">{d["cat"]}</span><span class="tag stage">{stagetxt(d)}</span></div>'
            f'<span class="eyebrow" style="display:block;margin-top:22px">{d["ins"]}</span><h1>{d["sector"]}</h1><p class="note">{d["hl"]}</p>'
            f'<div style="margin-top:22px;max-width:520px">{runway(d)}</div><ol class="stagebar" style="padding:0" aria-label="Stage: {now}">{bar}</ol></div>'
            f'<aside class="side rv inview" style="--d:.1s">{facts(d)}<div class="gate"><span class="k"><span class="lock"></span> Registered family offices see</span><ul>'
            '<li>Company name<span class="v">Redacted Pvt Ltd</span></li><li>Round size and pre-money<span class="v">₹000 Cr</span></li>'
            '<li>P/E, trailing and forward<span class="v">00x · 00x</span></li><li>The desk\'s fee<span class="v">Stated in room</span></li>'
            '<li>Audited financials, FY24–26<span class="v">3 files</span></li></ul></div>'
            f'{cta}<p class="fine">No fee for family offices, on any deal. One registration, PAN check and NDA open every room on the desk.</p></aside></article>'
            '<section class="sec tight" style="padding-top:0" id="public-diligence"><div class="sec-head rv inview"><div><span class="eyebrow">Published for everyone</span>'
            '<h2 style="font-size:26px">What the desk has checked, and the risks it sees</h2><p>The tracker and the risks are public in outline. The findings, documents and the company\'s name open in the room.</p></div>'
            f'<a class="btn" href="{pre}diligence.html">How we check</a></div><div class="chart rv inview"><span class="k">Diligence tracker</span>{track}</div></section>'
            '<section class="sec tight" style="padding-top:0"><div class="sec-head rv inview"><div><span class="eyebrow">Also on the desk</span><h2 style="font-size:26px">Other outlines</h2></div></div>'
            f'<ul class="more rv inview">{more}</ul></section></div></main>')
    h = rsub(h, r'<main>.*?</main>', main, f'{f} main', count=1)
    open(f, 'w').write(h)

# ---------------------------------------------------------------- sample rooms
for d in DEALS:
    if d['slug'] == 'naval-defence-secondary': continue
    f = f'room/{d["slug"]}.html'; h = open(f).read()
    msg = ('Not open. With no listing scheduled it does not meet the IPO-bound test, so the desk has not opened a room.' if d.get('notopen')
           else 'Illustrative sample. There is no room behind this outline; it exists to show the format. The naval defence secondary is the live room.')
    h = sub1(h, '<p>This room is being prepared. Register and we will open it to you the day it is ready.</p><a class="btn primary" href="../register.html">Register</a>',
             f'<p>{msg}</p><a class="btn primary" href="../room/naval-defence-secondary.html">See the live room</a>', f'{f} gate')
    open(f, 'w').write(h)

# ---------------------------------------------------------------- Krasny room
f = 'room/naval-defence-secondary.html'; h = open(f).read()
h = sub1(h, '<div class="kv"><span>Stage</span><b>Open for interest</b></div>',
         '<div class="kv"><span>Status</span><b>Room open to registered offices</b></div><div class="kv"><span>Desk fee</span><b>Paid by the selling shareholders. Amount, and cash or shares, to be stated here before any commitment; commercials are still under discussion.</b></div>', 'room status+fee')
h = sub1(h, '<span class="k">Why it is undiscovered</span>', '<span class="k">Why it is on the desk</span>', 'room undisc')
h = sub1(h, 'understand which entities carry the margin before pricing on 18x FY27E.</li></ul>',
         'understand which entities carry the margin before pricing on 18x FY27E.</li>'
         '<li><b>Foreign investors.</b> Defence is a licensed sector with FDI limits. Non-resident offices need the FEMA route, pricing basis and filings confirmed before committing.</li>'
         '<li><b>Exit through an IPO offer for sale.</b> Shares offered in an IPO must have been held for a year before the DRHP is filed, and pre-IPO shares are locked in for six months after listing. Plan to hold through both.</li></ul>', 'room risks')
h = h.replace('5<!-- --> flagged, see Overview', '6<!-- --> flagged, see Overview')
h = sub1(h, '<p class="fine">Indicative only. We confirm availability with the seller and send the term sheet within two working days.</p>',
         '<p class="fine">Non-binding indication. The desk confirms availability with the seller. A commitment is made only on signed documents after KYC, with a summary of terms, the desk\'s fee and the risks to confirm first.</p>', 'room interest note')
h = sub1(h, '<span class="eyebrow">Express interest</span><h3>Reserve an allocation</h3>', '<span class="eyebrow">Indicate interest</span><h3>Request an allocation</h3>', 'room interest head')
CALL = ('<div class="callbox" id="call"><h3>Request a management call</h3><p class="fine">Calls are group sessions under the NDA. Information that will not appear in the offer documents is not shared on calls, '
        'and a written summary is posted to this room for every registered office.</p><form class="form" id="callform" novalidate>'
        '<div class="row"><label>Preferred slot<select required name="slot"><option value="" disabled selected>Select</option><option>Weekday morning</option><option>Weekday afternoon</option><option>Weekday evening</option></select></label>'
        '<label>Attendees from the office<input name="who" required placeholder="e.g. Principal, CIO, CA"></label></div>'
        '<label>Questions in advance<textarea name="qs" rows="2" placeholder="Shared with the company before the call"></textarea></label>'
        '<div><button class="btn primary" type="submit">Request call</button></div><div class="ok" role="status"></div></form></div>')
h = sub1(h, '<div><button class="btn" type="submit">Submit question</button></div></form></section>',
         '<div><button class="btn" type="submit">Submit question</button></div></form>' + CALL + '</section>', 'room call')
open(f, 'w').write(h)

f = 'room/naval-defence-secondary/memo.html'; h = open(f).read()
h = sub1(h, 'understand which entities carry the margin before pricing on 18x FY27E.</li>',
         'understand which entities carry the margin before pricing on 18x FY27E.</li><li><b>Foreign investors.</b> Defence is a licensed sector with FDI limits; the FEMA route must be confirmed for non-residents.</li>'
         '<li><b>Exit through an IPO offer for sale.</b> One-year holding before the DRHP for shares offered in an IPO, and a six-month lock-in after listing.</li>', 'memo risks')
h = h.replace('<title>Deal summary · Pehla Round</title>', '<title>Deal summary · Pehla Round</title>')
open(f, 'w').write(h)

# ---------------------------------------------------------------- registration: progressive, entity-aware, privacy notice
f = 'register.html'; h = open(f).read()
h = sub1(h, '<h1>One registration opens the whole shelf</h1><p class="lede">One registration for the office opens every deal on the desk: company names, valuation, financials, data rooms and promoter sessions. No fee for family offices, ever.</p>',
         '<h1>Register the office</h1><p class="lede">Step one takes a minute and shows you the outlines. PAN and the investing entity come at step two, and KYC only if you commit. No fee for family offices, ever.</p>'
         '<ol class="statusrail" id="regrail" aria-label="Your status"><li class="now">Registered</li><li>PAN verified</li><li>NDA e-signed</li><li>Rooms unlocked</li></ol>', 'reg head')
h = sub1(h, '<li>PAN is used only to prepare documents; it is never shown.</li>', '<li>Step 2 asks for the investing entity, its PAN and residency; step 3, only at commitment, asks for KYC, bank account, demat and the authorised signatory.</li>', 'reg ticks')
h = rsub(h, r'<div class="row"><label>PAN of the investing entity.*?</label><label>Your role', '<div class="row"><label>Your role', 'reg pan out', count=1)
h = sub1(h, '<option>Single family office</option><option>Multi-family office</option><option>Family trust or HUF</option><option>Family holding company or LLP</option><option>Principal in own name</option><option>Fund or institution (by introduction)</option>',
         '<option>Individual</option><option>HUF</option><option>Private company</option><option>LLP</option><option>Trust</option><option>Family-office AIF</option><option>Other</option>', 'reg entity')
h = sub1(h, '<label>Typical ticket per deal<select name="ticket" required="">',
         '<label>Residency<select name="residency" required=""><option value="" disabled="" selected="">Select</option><option>Resident in India</option><option>Non-resident (FEMA route applies)</option></select></label></div><div class="row"><label>Typical ticket per deal<select name="ticket" required="">', 'reg residency')
h = sub1(h, '<option>Above ₹25 crore</option></select></label></div>', '<option>Above ₹25 crore</option></select></label><label>Viewers to add (optional)<input name="viewers" placeholder="CIO, CFO or CA emails"></label></div>', 'reg viewers')
h = sub1(h, '<label class="chk"><input type="checkbox" required="" name="nda">I will keep every company name, document and term shared with me confidential, use it only to evaluate an investment by this family office, and share it only with the office\'s own advisers under the same undertaking.</label>',
         '<p class="notice"><b>Privacy notice.</b> We use these details to identify your office and, at step two, to verify PAN and prepare documents. We keep them while the office is registered and for the period the law requires for offeree records, then delete them. You can ask for a copy, a correction or deletion at desk@pehlaround.in. Full notice: <a href="legal.html">privacy</a>.</p>'
         '<label class="chk"><input type="checkbox" required="" name="privacy">I have read the privacy notice and consent to this use of my details.</label>', 'reg nda->privacy')
h = sub1(h, 'Pehla Round may call, email or WhatsApp me about deals on the desk.', 'Optional: Pehla Round may call, email or WhatsApp me about deals on the desk. I can withdraw this at any time.', 'reg contact')
h = h.replace('<input type="checkbox" required="" name="contact">', '<input type="checkbox" name="contact">')
open(f, 'w').write(h)

f = 'nda.html'; h = open(f).read()
h = sub1(h, '<label>Type your full name as signature<input required="" autocomplete="name" placeholder="As on PAN" name="sig"></label>',
         '<label>PAN of the investing entity<input required="" pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" placeholder="ABCDE1234F" style="text-transform:uppercase" name="pan"><span class="hint">Checked against the name on PAN before any room opens. Never shown to companies or other offices.</span></label>'
         '<label>Full name, as on PAN<input required="" autocomplete="name" name="sig"></label>', 'nda pan')
h = sub1(h, '<button class="btn primary" type="submit">Sign and open the desk</button>', '<button class="btn primary" type="submit">Verify PAN and e-sign</button>', 'nda btn')
h = sub1(h, 'Signing records your name, the time, your IP address and the undertaking version. A copy is emailed to you.',
         'In the live product the undertaking is e-signed with Aadhaar or a DSC and stamped. Signing records your name, the time and the undertaking version; a copy is emailed to you. This preview only simulates the step.', 'nda fine')
h = h.replace('<span class="t">Sign the NDA</span><span class="s">one signature</span>', '<span class="t">PAN and NDA</span><span class="s">verify and e-sign</span>')
open(f, 'w').write(h)
h = open('register.html').read().replace('<span class="t">Sign the NDA</span><span class="s">one signature</span>', '<span class="t">PAN and NDA</span><span class="s">verify and e-sign</span>'); open('register.html', 'w').write(h)

# ---------------------------------------------------------------- how it works
f = 'how-it-works.html'; h = open(f).read()
h = sub1(h, '<h3>Register</h3><p>One form: the office, who makes the decisions, PAN, and the ticket size you work with. Add your CIO or CA as a viewer.</p>',
         '<h3>Register</h3><p>Name, office, email, mobile and role. That is enough to see the outlines.</p>', 'hiw 01')
h = sub1(h, '<h3>Accept the NDA</h3>', '<h3>Verify PAN and e-sign the NDA</h3>', 'hiw 02')
h = sub1(h, '<h3>Express interest</h3><p>Tell us the amount. We call you within two working days with the promoter\'s availability.</p>',
         '<h3>Indicate interest</h3><p>Indicate an amount in the room. It is non-binding until you confirm a summary of terms, fee and risks after KYC.</p>', 'hiw 04')
h = sub1(h, '<h3>Meet the promoter</h3><p>A private call or a small-group session with the founder or CFO, your questions answered, diligence file open.</p>',
         '<h3>Request a management call</h3><p>From the room. Calls are group sessions under NDA, and the written summary is posted for every registered office.</p>', 'hiw 05')
h = sub1(h, '<h3>Allotment and updates</h3><p>Shares in the family\'s demat. Quarterly updates on the desk until the company lists.</p>',
         '<h3>Allotment and updates</h3><p>Shares in the family\'s demat. Quarterly updates, listing milestones and lock-in end dates in the office\'s dashboard.</p>', 'hiw 07')
h = rsub(h, r'<details><summary>Is the diligence tracker the same for everyone\?</summary>.*?</details>', '', 'hiw faq tracker')
h = rsub(h, r'<details><summary>Do you tell me the bad news\?</summary>.*?</details>', '', 'hiw faq bad news')
h = h.replace("it goes into your office's diary.", "it goes into your office's dashboard.")
open(f, 'w').write(h)

# ---------------------------------------------------------------- founders: trim intake
f = 'founders.html'; h = open(f).read()
h = sub1(h, '<label>In a few lines<textarea name="note" rows="3" placeholder="What the business does, FY26 PAT, and when you plan to list"></textarea></label>',
         '<div class="row"><label>FY26 PAT<select name="pat" required=""><option value="" disabled="" selected="">Select</option><option>Loss or break-even</option><option>Under ₹5 Cr</option><option>₹5–25 Cr</option><option>Above ₹25 Cr</option></select></label>'
         '<label>Target listing<select name="listing" required=""><option value="" disabled="" selected="">Select</option><option>Within 24 months, SME</option><option>Within 24 months, main board</option><option>24–36 months</option><option>Not decided</option></select></label></div>'
         '<label>Anything else (optional)<textarea name="note" rows="2" placeholder="No financial statements, cap tables or documents at this stage; those come after a mutual NDA"></textarea></label>', 'founders intake')
h = sub1(h, '<li>You pay the desk, investors never do: a listing fee when the round goes on the desk and a success fee on close, disclosed to every office in the room. Terms on the first call.</li>',
         '<li>You pay the desk, investors never do: a listing fee when the round goes on the desk and a success fee on close, in cash or shares, within the limits of the Companies Act and disclosed to every office in the room and in the offer letter.</li>', 'founders fee')
open(f, 'w').write(h)

# ---------------------------------------------------------------- webinars
f = 'webinars.html'; h = open(f).read()
h = sub1(h, 'A private call can be arranged for a larger ticket.', 'Every registered office gets the same session and the same written summary.', 'web private call')
open(f, 'w').write(h)

# ---------------------------------------------------------------- legal: privacy and grievance
f = 'legal.html'; h = open(f).read()
h = sub1(h, 'You may ask for your details to be corrected or deleted at desk@pehlaround.in, subject to records the law requires the desk to keep.</p>',
         'You may ask for your details to be corrected or deleted at desk@pehlaround.in, subject to records the law requires the desk to keep.</p>'
         '<h2>Grievances and data protection</h2><p>Grievance officer and data-protection contact: [name to be added], desk@pehlaround.in. We acknowledge a grievance within two working days. Consent to calls and WhatsApp messages is separate and can be withdrawn at any time.</p>'
         '<h2>Site disclaimer</h2><p>Every visitor accepts the site disclaimer before using the site; acceptance is recorded with the time and the version of the text. <a href="#" data-show-disclaimer>Read it again</a>.</p>', 'legal grievance')
open(f, 'w').write(h)

# ---------------------------------------------------------------- About us (new page, built on the legal page shell)
h = open('legal.html').read()
ABOUT = ('<main><div class="wrap phead"><span class="eyebrow">About us</span><h1>Who runs the desk</h1><p>Pehla Round is a deal desk promoted by a Mumbai family office. This page names the people, the legal entity, what it is and is not registered as, and how it is paid.</p></div>'
 '<section class="sec tight"><div class="wrap prose">'
 '<h2>The people</h2><div class="people"><div><b>[Founder name]</b><p class="fine">Founder · credentials and prior roles to be added</p></div><div><b>[Desk lead]</b><p class="fine">Desk lead · credentials and prior roles to be added</p></div><div><b>[Diligence lead]</b><p class="fine">Diligence lead · credentials and prior roles to be added</p></div></div>'
 f'<h2>The legal entity</h2><p>{OPERATOR} · CIN [to be added] · Registered office [to be added], Mumbai · GSTIN [to be added]. Promoted by [family office to be named].</p>'
 '<h2>What we are, and are not</h2><p>A deal desk that introduces registered family offices to private companies and shareholders, builds the deal room and documents the transaction. Not a stock exchange, trading platform, broker, merchant banker, research analyst or investment adviser, and not registered with SEBI or the RBI. Where a deal needs a registered intermediary, such as a merchant banker for an IPO, the room names it.</p>'
 '<h2>How we are paid, and our conflicts</h2><p>Family offices pay nothing. The company or selling shareholder pays a listing fee when a round goes on the desk and a success fee when it closes; the amount, and whether it is paid in cash or shares, is stated in each room and in the offer letter. The desk puts 5% into every round that subscribes, at the same price and lock-in, and never resells that stake through the desk. Because the desk is paid when rounds close, it has a reason to want them to close; the tracker rules on <a href="diligence.html">How we check</a> are how it limits that conflict.</p>'
 '<h2>For companies</h2><p>The desk takes profitable companies with a stated listing plan that meet five tests: not carried elsewhere, revenue and profit today, demonstrably IPO-bound, entry under 10x earnings, and the promoter keeps the majority. Intake to a decision on a room usually takes a few weeks. <a href="founders.html">List your company</a>.</p>'
 '<h2>Grievances and data protection</h2><p>Grievance officer and data-protection contact: [name to be added], desk@pehlaround.in.</p>'
 '</div></section></main>')
h = rsub(h, r'<main>.*?</main>', ABOUT, 'about main', count=1)
h = re.sub(r'<title>.*?</title>', '<title>About us · Pehla Round</title>', h, count=1)
h = h.replace('aria-current="page"', '').replace('<a href="about.html">About us</a></nav>', '<a href="about.html" aria-current="page">About us</a></nav>')
open('about.html', 'w').write(h)

# ---------------------------------------------------------------- diary page becomes a dashboard preview
f = 'diary.html'; h = open(f).read()
h = h.replace('<title>Your diary · Pehla Round</title>', '<title>Dashboard preview · Pehla Round</title>')
h = h.replace('<span class="eyebrow lock">Your diary</span><h2>The office\'s record, deal after deal</h2>', '<span class="eyebrow lock">Office dashboard · preview</span><h2>The office\'s record, deal after deal</h2>')
open(f, 'w').write(h)

# ---------------------------------------------------------------- report
left = {}
for f in glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('*/*/*.html'):
    t = open(f).read()
    for p in ['Found only here', 'investment banking', 'IC memo', 'paid when you commit', 'takes 5', 'Jul 2027', 'listing is the upside', '% committed', 'months</b> to IPO', 'Your diary', 'Open deal room']:
        if p in t: left.setdefault(p, []).append(f)
print('MISSES:', MISS)
print('LEFT:', json.dumps(left, indent=0))
