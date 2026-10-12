#!/usr/bin/env python3
"""v25: no mention of the desk's 5% anywhere; remove 'Who pays whom'; founders CTA line; Dashboard in the menu."""
import re, glob
FILES = sorted(glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('*/*/*.html'))
def card(eyebrow, title, body, see):
    return f'<span class="eyebrow">{eyebrow}</span><h3>{title}</h3><p>{body}</p><p class="see"><b>What you see:</b> {see}</p>'
R = [
 ('<p class="deskpct"><i></i> Desk invests 5% of this round at close, same terms</p>', ''),
 (', and puts 5% into each round that subscribes, on the same price and lock-in; both are stated in each deal room.', '; the fee is stated in each deal room.'),
 ('The company or selling shareholder pays the desk a fee, and the desk invests 5% of each round that subscribes, on the same terms as investors. Both are disclosed in each deal room.',
  'The company or selling shareholder pays the desk a fee, disclosed in each deal room.'),
 (',\n      ["Desk position", function () { return "5% if the round subscribes, same price and lock-in"; }]', ''),
 (' The desk puts 5% into every round that subscribes, at the same price and lock-in, and never resells that stake through the desk. Because the desk is paid when rounds close, it has a reason to want them to close; the tracker rules on <a href="diligence.html">How we check</a> are how it limits that conflict.', ''),
 (' The desk invests 5% of every round that successfully subscribes on the desk, on the same price and terms as investors and subject to the same lock-in; each room states this and any deal-specific position.', ''),
 ('<li>The desk invests 5% of every round that subscribes, on the same terms as the offices, so investors see a desk with money behind its tracker.</li>', ''),
 (', and puts 5% into the round itself when it subscribes.', '.'),
 ('<path class="farrow own" d="M550 258 C 650 258, 715 225, 745 190" marker-end="url(#mh)"></path><text class="fs" x="700" y="284" text-anchor="middle">Desk\'s own 5% · same terms · at close</text>', ''),
 ('; the desk invests 5% of every round that subscribes on the same terms"', '"'),
 ('>before the bankers · 5% is ours too<', '>before the bankers<'),
 ('<b>Promoter skin, and ours</b><span>Promoter keeps the majority through the round and the listing. The desk puts 5% into every round that subscribes, on the same terms.</span>',
  '<b>Promoter keeps the majority</b><span>The promoter keeps control through the round and the listing, so the people who built the business stay in it.</span>'),
 ('<li><b>Our money follows yours.</b> The desk puts <!-- -->5<!-- -->% into every round that subscribes, on the same terms. It cannot soften a tracker on a deal it will own too.</li>', ''),
 ('<div class="kv"><span>Our capital</span><b>5% of the round (₹2.5 Cr of ₹50 Cr) on successful subscription, at ₹105 a share, same lock-in. Sub-mandate in place with the original mandate holder.</b></div>', ''),
 ('aria-label="5% of the round: desk invests at close"', 'aria-label="Close: allotment and reporting"'),
 ('>5% of the round<', '>Close<'), ('>desk invests at close<', '>allotment · reporting<'),
 ('<text class="ps crossl" x="992" y="212" text-anchor="start">desk\'s <!-- -->5<!-- -->% joins</text>', ''),
 ('<p>The desk is paid by the company when a round closes, and it puts 5% of its own money into every round that closes. So it wants rounds to close. That is exactly why the tracker is built the way it is: the same standard checks for every deal, the risks printed before the numbers, nothing marked done that is not, and a pass that nobody follows up on. The desk never takes a better price than you, and its own 5% is locked in for as long as yours.</p>',
  '<p>The company or the selling shareholder pays the desk a listing fee and a success fee, stated in each room. The tracker works the same way on every deal: the same standard checks, the risks printed before the numbers, nothing marked done that is not, and a pass that nobody follows up on.</p>'),
]
for f in FILES:
    h = open(f).read(); o = h
    for a, b in R: h = h.replace(a, b)
    h = re.sub(r'<details><summary>Does the desk invest alongside me\?</summary>.*?</details>', '', h, flags=re.S)
    h = re.sub(r'<p><b>Our capital:</b>.*?</p>', '', h, flags=re.S)
    h = re.sub(r'<p style="color:var\(--ink2\);margin-top:10px;max-width:60ch">A registered base of family offices.*?</p>', '', h, flags=re.S)
    h = re.sub(r'<section class="sec band"><div class="wrap"><div class="sec-head rv inview"><div><span class="eyebrow">How the money moves</span>.*?</section>', '', h, flags=re.S)
    h = re.sub(r'(<div class="pflow-card" data-panel="d6"(?: hidden="")?>).*?(</div>(?=<div class="pflow-card"))',
               lambda m: m.group(1) + card('The desk · At close', 'Close', 'When the round subscribes, the desk completes the closing with the company or seller and keeps reporting to every office until the listing.', 'Closing status and updates, in the room and your dashboard.') + m.group(2), h, count=1, flags=re.S)
    # Dashboard in the menus
    pre = (re.search(r'data-root="([^"]*)"', h) or [None, ''])[1] if 'id="root"' in h else ''
    h = h.replace(f'<a href="{pre}founders.html">List your company</a></nav>', f'<a href="{pre}founders.html">List your company</a><a href="{pre}dashboard.html">Dashboard</a></nav>')
    h = h.replace(f'<a href="{pre}founders.html" aria-current="page">List your company</a></nav>', f'<a href="{pre}founders.html" aria-current="page">List your company</a><a href="{pre}dashboard.html">Dashboard</a></nav>')
    h = h.replace(f'<a href="{pre}founders.html">List your company</a><a href="{pre}register.html">Sign in</a>', f'<a href="{pre}founders.html">List your company</a><a href="{pre}dashboard.html">Dashboard</a><a href="{pre}register.html">Sign in</a>')
    h = h.replace(f'<a href="{pre}founders.html">List your company</a><a href="{pre}dashboard.html">Sign in</a>', f'<a href="{pre}founders.html">List your company</a><a href="{pre}dashboard.html">Dashboard</a><a href="{pre}register.html">Sign in</a>')
    h = h.replace(f'<a href="{pre}founders.html">List your company</a><a href="{pre}legal.html">', f'<a href="{pre}founders.html">List your company</a><a href="{pre}dashboard.html">Dashboard</a><a href="{pre}legal.html">')
    if f == 'dashboard.html':
        h = h.replace('<a href="dashboard.html">Dashboard</a></nav>', '<a href="dashboard.html" aria-current="page">Dashboard</a></nav>')
    if h != o: open(f, 'w').write(h)
left = []
for f in FILES:
    t = re.sub(r'<style.*?</style>', '', open(f).read(), flags=re.S)
    for m in re.finditer(r'(?<![\d.])5(?:<!-- -->)?%', t): left.append((f, t[m.start()-60:m.end()+30]))
print(len(left)); [print(x) for x in left[:12]]

# header fit CSS (id v25) added to every page in v25
