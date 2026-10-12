#!/usr/bin/env python3
"""v23: market news in the feed; niche copy; no literal 10x; the desk's full workflow; ISIN/demat on cards;
drop the conflict line. Run from the repo root after v22."""
import re, glob

FILES = sorted(glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('*/*/*.html'))
MISS = []
def sub(h, a, b, label):
    if a not in h: MISS.append(label); return h
    return h.replace(a, b)

# ---------------------------------------------------------------- copy everywhere
TEST_OLD = ('<b>Under 10x earnings</b><span>Entry at a single-digit multiple of earnings. Every room shows pre-money valuation with trailing and forward P/E side by side, so the test can be checked.</span>')
TEST_NEW = ('<b>Priced below the listed peers</b><span>Entered at a clear discount to where comparable listed companies trade. Faster-growing sectors earn higher multiples, so every room sets trailing and forward P/E next to the listed peer set, and the test can be checked.</span>')
GLOBAL = [
    (TEST_OLD, TEST_NEW),
    ("revenue and profit today, a demonstrable path to listing, and an entry under 10x earnings.",
     "revenue and profit today, a demonstrable path to listing, and an entry priced below where its listed peers trade."),
    ("demonstrably IPO-bound, entry under 10x earnings, and the promoter keeps the majority.",
     "demonstrably IPO-bound, priced below its listed peers, and the promoter keeps the majority."),
    ("<span>Would you raise at under 10x earnings?</span>", "<span>Would you price the round below where your listed peers trade?</span>"),
    (" That fee is a conflict of interest, which is why the tracker rules above exist.", ""),
    ('<div><dt>Desk position</dt><dd>5% at close</dd></div>', '<div><dt>Shares</dt><dd>Demat · ISIN active</dd></div>'),
]
for f in FILES:
    h = open(f).read(); o = h
    for a, b in GLOBAL: h = h.replace(a, b)
    if h != o: open(f, 'w').write(h)

h = open('index.html').read()

# ---------------------------------------------------------------- niche
h = sub(h, '<p><b>Profitable private companies with a stated listing plan, priced on earnings.</b> Found through promoters, CAs and lenders, not decks, and not on other unlisted platforms when they come to the desk. Each is screened against five published tests and the same ten checks; the desk records facts and does not rate or recommend.</p>',
        '<p><b>IPO-bound gems, before the crowd finds them.</b> Profitable companies on their way to a listing that no unlisted platform is marketing, bought directly from the promoter while the valuation is still sensible. Each one is screened against five published tests and the same ten checks.</p>', 'niche')

# ---------------------------------------------------------------- product flow: the desk's heavy lifting, then every step after yes
h = sub(h, 'What the desk does before a company is shown, and what your office does after. Click any step, or let it play.',
        'The desk does the heavy lifting before any office sees a company, and runs every step after you say yes. Click any step, or let it play.', 'flow intro')
def card(eyebrow, title, body, see):
    return f'<span class="eyebrow">{eyebrow}</span><h3>{title}</h3><p>{body}</p><p class="see"><b>What you see:</b> {see}</p>'
PANELS = {
 'd1': card('The desk · Before anyone sees it', 'Sourcing',
            'The desk finds IPO-bound companies before any banker or unlisted platform is marketing them, and deals directly with the promoter.',
            'Nothing yet. This is the heavy lifting you never have to do.'),
 'd2': card('The desk · Weeks, per company', 'Primary diligence',
            'Meetings with the promoter and the management team, plant and site visits, customer verifications and a read of the competitive landscape, all before a single office is approached.',
            'What the desk found, and the risks it sees, in the room.'),
 'd3': card('The desk · Before the raise is shown', 'Valuation and plans',
            'The desk sets up the valuation against listed peers, reviews the growth plan, the business and the listing plan, and guides the promoter on what the round and the IPO path need. Same terms for every office, lock-in stated.',
            'The terms, the valuation basis and the peer set, in the Terms panel.'),
 'd5': card('The desk · Before outreach starts', 'Room built',
            'Every data-room document in place before the first office is contacted: memorandum, financials, shareholding, title and contracts. Snapshot, multiples, terms, IPO path, diligence, Q&amp;A and a one-page deal summary, in the same layout for every deal.',
            'All of it, the moment your NDA is signed.'),
 'o4': card('Your office · Days', 'Promoter calls',
            'The desk sets up calls with the promoter and the management team, as group sessions under the NDA, and posts a written summary for every office. Questions can also go in writing.',
            'Every answer, with who gave it and when.'),
 'o5': card('Your office · Your decision', 'Term sheet and diligence',
            'Indicate an amount and the desk shares the draft term sheet and shareholders\' agreement. Independent due diligence by a trusted firm can be run before you sign. You confirm on a summary of terms and risks after KYC, or pass with a one-line reason.',
            'The drafts, the diligence report and your allocation, in the dashboard.'),
 'o6': card('Your office · Weeks, then years', 'Compliance and allotment',
            'The desk runs the paperwork: escrow account, board and shareholder resolutions with MGT-14, the private placement offer letter and the PAS-3 return of allotment, or the share transfer for a secondary. Money moves to the company or seller through escrow.',
            'Shares credited to the family\'s demat, then quarterly updates and lock-in dates in the dashboard.'),
}
for k, v in PANELS.items():
    h, n = re.subn(r'(<div class="pflow-card" data-panel="%s"(?: hidden="")?>).*?(</div>(?=<div class="pflow-card"|<div class="pflow-nav"))' % k,
                   lambda m: m.group(1) + v + m.group(2), h, count=1, flags=re.S)
    if not n: MISS.append('panel ' + k)
LABELS = [('>Sourcing<', '>Sourcing<'), ('>promoters · CAs · lenders<', '>direct from the promoter<'),
          ('>Five tests<', '>Primary diligence<'), ('>most raises fail here<', '>teams · sites · customers<'),
          ('>Negotiation<', '>Valuation · plans<'), ('>price · terms · lock-in<', '>peers · growth · listing<'),
          ('>seven panels · Deal summary<', '>data room complete<'),
          ('>Ask · meet<', '>Promoter calls<'), ('>written Q&amp;A · promoter session<', '>set up by the desk<'),
          ('>Commit or pass<', '>Term sheet · DD<'), ('>your call, no follow-up<', '>SHA · independent DD<'),
          ('>Allotment · diary<', '>Compliance<'), ('>reports until listing<', '>escrow · MGT-14 · PAS-3<')]
i = h.find('<div class="pflow-scroll">'); j = h.find('</svg>', i)
svg = h[i:j]
for a, b in LABELS:
    if a not in svg: MISS.append('label ' + a)
    svg = svg.replace(a, b, 1)
h = h[:i] + svg + h[j:]

# the five tests in the flow panel no longer exist as a step; keep them listed in the Why section only

# ---------------------------------------------------------------- feed: market news
NEWS = [
    ("12 Oct", "Eight IPOs worth about ₹11,000 Cr open this week, led by Zetwerk (₹5,012 Cr) and Bonfiglioli Transmissions (₹2,534 Cr)", "indiaipo.in"),
    ("12 Oct", "Tonbo Imaging's ₹852 Cr IPO opens 15 Oct at ₹665–700 a share", "indiaipo.in"),
    ("12 Oct", "Foreign investors have pulled ₹44,166 Cr from Indian equities in October; 2026 outflows pass ₹3 lakh Cr", "indiaipo.in"),
    ("12 Oct", "Shellz India gets SEBI approval for its IPO", "indiaipo.in"),
    ("12 Oct", "Udaan plans to list by early 2028", "indiaipo.in"),
    ("9 Oct", "Sensex up 1.1% to 72,394 and Nifty up 1.2% to 22,500 as IT leads a rebound", "Kotak Neo"),
]
items = ''.join(f'<li><span class="mono">{d}</span>{t} <small class="src">· {s}</small></li>' for d, t, s in NEWS)
h, n = re.subn(r'<ul class="feedlist">.*?</ul>', '<ul class="feedlist" id="newsfeed">' + items * 2 + '</ul>', h, count=1, flags=re.S)
if not n: MISS.append('feed')
h = sub(h, '<div class="feedstrip" aria-label="What changed on the desk"><span class="feedlabel"><i></i>Desk feed</span>',
        '<div class="feedstrip" aria-label="Market news"><span class="feedlabel"><i></i>Market news</span>', 'feed label')
NEWSJS = '''<script>
(function(){
  var ul=document.getElementById("newsfeed"); if(!ul||!window.fetch) return;
  fetch("/api/news",{cache:"no-store"}).then(function(r){return r.ok?r.json():null;}).then(function(d){
    if(!d||!d.items||d.items.length<3) return;
    var html="";
    d.items.slice(0,10).forEach(function(it){
      var li=document.createElement("li"), m=document.createElement("span"), a=document.createElement("a"), s=document.createElement("small");
      m.className="mono"; m.textContent=it.date||""; a.href=it.link; a.target="_blank"; a.rel="noopener"; a.textContent=it.title;
      s.className="src"; s.textContent=" · "+(it.source||""); li.appendChild(m); li.appendChild(a); li.appendChild(s); html+=li.outerHTML;
    });
    ul.innerHTML=html+html;
  }).catch(function(){});
})();
</script>'''
h = h.replace('</body>', NEWSJS + '</body>', 1)
h = h.replace('</head>', '<style id="v23">.feedlist .src{opacity:.6;font-size:11.5px}.feedlist a{color:inherit;text-decoration:none}.feedlist a:hover{text-decoration:underline}</style></head>', 1)
open('index.html', 'w').write(h)

# ---------------------------------------------------------------- how it works
f = 'how-it-works.html'; h = open(f).read()
h = sub(h, '<h3>Request a management call</h3><p>From the room. Calls are group sessions under NDA, and the written summary is posted for every registered office.</p>',
        '<h3>Promoter calls</h3><p>The desk sets up calls with the promoter and the management team, as group sessions under NDA, and posts a written summary for every registered office.</p>', 'hiw 05')
h = sub(h, '<h3>Commit and document</h3><p>Term sheet, subscription or share-transfer documents, e-signed. Money moves directly to the company or seller, never through us.</p>',
        '<h3>Term sheet, SHA and diligence</h3><p>The desk shares the draft term sheet and shareholders\' agreement, and independent due diligence by a trusted firm can be run before you sign. Documents are e-signed.</p>', 'hiw 06')
h = sub(h, '<h3>Allotment and updates</h3><p>Shares in the family\'s demat. Quarterly updates, listing milestones and lock-in end dates in the office\'s dashboard.</p>',
        '<h3>Compliance and allotment</h3><p>The desk handles the escrow account, MGT-14, the private placement offer letter and PAS-3 (or the share transfer for a secondary). Shares are credited to the family\'s demat; updates and lock-in dates follow in the dashboard.</p>', 'hiw 07')
h = sub(h, '<p>Private placements are done with identified investors, under documents, with money moving directly to the company or seller. The desk makes that path short for a family office.</p>',
        '<p>Before any office sees a company, the desk has met the team, visited the plant, verified customers, mapped the competition and set up the valuation and the listing plan. After you say yes, it runs every step to allotment.</p>', 'hiw lede')
open(f, 'w').write(h)

# ---------------------------------------------------------------- Krasny room: demat and ISIN
f = 'room/naval-defence-secondary.html'; h = open(f).read()
h = sub(h, '<div><dt>Family office ticket</dt><dd>₹1 Cr minimum; co-lead positions available</dd></div>',
        '<div><dt>Demat and ISIN</dt><dd>Equity shares held in demat with an active ISIN; transferred through the depository and credited to your demat against payment</dd></div><div><dt>Family office ticket</dt><dd>₹1 Cr minimum; co-lead positions available</dd></div>', 'room isin')
open(f, 'w').write(h)

print('MISSES:', MISS)
for f in FILES:
    t = open(f).read()
    for p in ['10x earnings', 'promoters, CAs and lenders', 'conflict of interest, which']:
        if p in t: print('left', p, f)
