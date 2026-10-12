#!/usr/bin/env python3
"""v27: visual 'How it works' journey; checks + tracker rules moved from home to How it works;
founders CTA line (50+ offices, 5% in every deal); no 'How we check' button in the hero."""
import re
MISS = []
def ic(p): return f'<svg viewBox="0 0 24 24" aria-hidden="true">{p}</svg>'
I = {
 'reg': ic('<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7"/><path d="M19 8v6M16 11h6"/>'),
 'nda': ic('<path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>'),
 'deals': ic('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
 'call': ic('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>'),
 'aim': ic('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'),
 'doc': ic('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
 'done': ic('<path d="M12 2l2.4 1.8 3 .2.9 2.9 2.2 2-.9 2.9.9 2.9-2.2 2-.9 2.9-3 .2L12 22l-2.4-1.8-3-.2-.9-2.9-2.2-2 .9-2.9-.9-2.9 2.2-2 .9-2.9 3-.2z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
}
PHASES = [
 ('Get in', 'Minutes', 'a', [
   ('reg', 'Register', 'Name, office, email, mobile and role. Every deal overview opens at once.', 'You'),
   ('nda', 'Verify PAN, e-sign the NDA', 'One e-signed undertaking covers every deal you open on the desk.', 'You')]),
 ('Evaluate', 'Days', 'b', [
   ('deals', 'Open the deals', 'Company names, financials, valuation and the data room unlock.', 'You'),
   ('call', 'Promoter calls', 'Group sessions with the promoter and management under NDA, with a written summary for every office.', 'The desk'),
   ('aim', 'Indicate interest', 'Non-binding until you confirm a summary of terms and risks after KYC.', 'You')]),
 ('Close', 'Weeks', 'c', [
   ('doc', 'Term sheet, SHA and diligence', 'Drafts shared by the desk, and independent due diligence by a trusted firm before you sign.', 'The desk'),
   ('done', 'Compliance and allotment', 'Escrow, MGT-14, offer letter and PAS-3, or the share transfer for a secondary. Shares land in your demat.', 'The desk')]),
]
def phase(i, name, when, cls, steps):
    li = ''.join(f'<li><span class="jr-ic">{I[k]}</span><div><b>{t}</b><p>{d}</p><span class="jr-who{" desk" if w == "The desk" else ""}">{w}</span></div></li>' for k, t, d, w in steps)
    return (f'<div class="jr-phase jr-{cls} rv inview" style="--d:{i*0.08:.2f}s"><div class="jr-head"><span class="jr-n">{i+1}</span>'
            f'<div><b>{name}</b><span>{when}</span></div></div><ol class="jr-steps">{li}</ol></div>')
JOURNEY = ('<div class="journey3">' + ''.join(phase(i, *p) for i, p in enumerate(PHASES)) + '</div>'
           '<p class="fine jr-note">Before any of this, the desk has met the team, visited the plant, verified customers, mapped the competition and set up the valuation and the listing plan.</p>')
CSS = '''<style id="v27">
.journey3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;position:relative}
.jr-phase{background:var(--bg2);border:1px solid var(--line);border-radius:16px;padding:20px 20px 8px;position:relative}
.jr-phase:not(:last-child)::after{content:"";position:absolute;right:-14px;top:34px;width:10px;height:10px;border-top:2px solid var(--line2,var(--line));border-right:2px solid var(--line2,var(--line));transform:rotate(45deg)}
.jr-head{display:flex;gap:12px;align-items:center;margin-bottom:14px}
.jr-n{width:34px;height:34px;border-radius:999px;display:grid;place-items:center;font-weight:600;color:#fff;background:var(--accent);flex:none}
.jr-b .jr-n{background:var(--live)}.jr-c .jr-n{background:var(--navy,#0f1530);box-shadow:inset 0 0 0 2px var(--accent)}
.jr-head b{display:block;font-size:18px}.jr-head div span{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}
.jr-steps{list-style:none;margin:0;padding:0;position:relative}
.jr-steps::before{content:"";position:absolute;left:19px;top:8px;bottom:26px;width:2px;background:linear-gradient(var(--accent),var(--live));opacity:.35}
.jr-steps li{display:grid;grid-template-columns:40px 1fr;gap:12px;padding:0 0 16px;position:relative}
.jr-ic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--bg);border:1px solid var(--line);z-index:1}
.jr-ic svg{width:20px;height:20px;fill:none;stroke:var(--accent);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.jr-b .jr-ic svg{stroke:var(--live)}
.jr-steps b{display:block;font-size:15px;margin-top:2px}.jr-steps p{margin:3px 0 6px;font-size:13.5px;line-height:1.5;color:var(--ink2)}
.jr-who{display:inline-block;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent)}
.jr-who.desk{background:color-mix(in srgb,var(--live) 14%,transparent);color:var(--live)}
.jr-note{margin-top:16px}
@media (max-width:900px){.journey3{grid-template-columns:1fr}.jr-phase:not(:last-child)::after{right:auto;left:36px;top:auto;bottom:-14px;transform:rotate(135deg)}}
</style>'''

# ---------------- how it works: journey + moved checks section
f = 'how-it-works.html'; h = open(f).read()
h, n = re.subn(r'<div class="steps full">.*?</div></div>(?=<div class="chart rv inview" style="margin-top: 28px;">)', JOURNEY, h, count=1, flags=re.S)
if not n: MISS.append('steps')
idx = open('index.html').read()
m = re.search(r'<section class="sec band" id="unbiased">.*?</section>', idx, re.S)
if not m: MISS.append('unbiased')
else:
    sec = m.group(0).replace('<div class="wrap">', '<div class="wrap"><div class="sec-head rv inview"><div><span class="eyebrow">How we check</span><h2>What the desk checks</h2><p>Every deal goes through a standard set of checks, plus whatever its sector and history call for, and the tracker follows the same rules for every office.</p></div></div>', 1)
    idx = idx.replace(m.group(0), '')
    anchor = '<section class="sec band"><div class="wrap"><div class="sec-head rv inview"><div><span class="eyebrow">Questions</span>'
    if anchor in h: h = h.replace(anchor, sec + anchor, 1)
    else: MISS.append('hiw anchor')
h = h.replace('</head>', CSS + '</head>', 1)
open(f, 'w').write(h)

# ---------------- home: hero button, founders line
a = '<a class="btn onnavy" href="diligence.html">How we check</a>'
if a in idx: idx = idx.replace(a, '')
else: MISS.append('hero btn')
a = '<h2 style="margin-top:10px">Raising ₹10–100 Cr before an IPO? Put it on the desk.</h2>'
if a in idx: idx = idx.replace(a, a + '<p style="color:var(--ink2);margin-top:10px;max-width:62ch">Put your round in front of 50+ family offices already on the desk, with a partner that backs every deal with its own capital.</p>')
else: MISS.append('founders cta')
open('index.html', 'w').write(idx)
print('MISSES', MISS)
