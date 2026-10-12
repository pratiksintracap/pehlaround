#!/usr/bin/env python3
"""v30: favicon set and link-preview (Open Graph / Twitter) tags on every page."""
import re, glob, html
BASE = "https://pehlaround.vercel.app"   # switch to https://pehlaround.in once the domain points at Vercel
SITE_DESC = "Invitation-only deal desk for family offices: profitable, IPO-bound companies before the crowd finds them, checked before you see them."
DESC = {
 'index.html': SITE_DESC,
 'deals.html': "Pre-IPO and growth rounds on the desk, shown without company names. Register to see the company, valuation and data room.",
 'how-it-works.html': "From registration to allotment: how a family office evaluates and closes a pre-IPO round on Pehla Round.",
 'about.html': "Pehla Round is run by SintraCap, a Mumbai family office with 40+ years in Indian capital markets.",
 'founders.html': "Raising ₹10–100 Cr before an IPO? Put your round in front of 50+ family offices.",
 'dashboard.html': "Your office's deals, rooms, calls, documents and portfolio in one place.",
}
for f in sorted(glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('*/*/*.html')):
    h = open(f).read()
    h = re.sub(r'<!--og-->.*?<!--/og-->', '', h, flags=re.S)
    titles = re.findall(r'<title>([^<]*)</title>', h)
    title = next((t for t in titles if 'Pehla Round' in t), 'Pehla Round')
    if title == 'Pehla Round': title = 'Pehla Round · IPO-bound gems for family offices'
    path = '/' + ('' if f == 'index.html' else f[:-5])
    d = DESC.get(f, SITE_DESC)
    t, d = html.escape(title, quote=True), html.escape(d, quote=True)
    tags = (f'<!--og--><title>{t}</title><meta name="description" content="{d}">'
            f'<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">'
            f'<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#0b1730">'
            f'<link rel="canonical" href="{BASE}{path}">'
            f'<meta property="og:type" content="website"><meta property="og:site_name" content="Pehla Round"><meta property="og:title" content="{t}">'
            f'<meta property="og:description" content="{d}"><meta property="og:url" content="{BASE}{path}">'
            f'<meta property="og:image" content="{BASE}/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
            f'<meta property="og:image:alt" content="Pehla Round: IPO-bound gems, before the crowd finds them.">'
            f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{t}"><meta name="twitter:description" content="{d}"><meta name="twitter:image" content="{BASE}/og.jpg"><!--/og-->')
    h = re.sub(r'(<head[^>]*>)', lambda m: m.group(1) + tags, h, count=1)
    open(f, 'w').write(h)
# v30: charset moved to the top of <head> on every page (by hand)
