#!/usr/bin/env python3
"""v28: structured footer (brand, explore, company, legal, disclaimer, bottom bar)."""
import re, glob
FILES = sorted(glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('*/*/*.html'))
CSS = '''<style id="v28">
footer .ft-grid{display:grid;grid-template-columns:1.4fr 1fr 1.3fr 1fr;gap:32px;padding:8px 0 28px;border-bottom:1px solid var(--line)}
footer .ft-brand .logo{display:inline-flex;align-items:center;gap:10px;font-weight:600;font-size:17px;color:var(--ink);text-decoration:none}
footer .ft-brand p{margin:12px 0 14px;font-size:14px;line-height:1.55;color:var(--ink2);max-width:32ch}
footer .ft-brand a.mail{font-size:14px;color:var(--ink);text-decoration:none;border-bottom:1px solid var(--line2,var(--line))}
footer .ft-col h4{margin:0 0 12px;font-family:var(--mono);font-size:10.5px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}
footer .ft-col ul{list-style:none;margin:0;padding:0;display:grid;gap:9px}
footer .ft-col a{color:var(--ink2);text-decoration:none;font-size:14px}
footer .ft-col a:hover,footer .ft-brand a.mail:hover{color:var(--ink)}
footer .ft-col li.kv{font-size:13px;line-height:1.5;color:var(--ink2)}
footer .ft-col li.kv b{display:block;font-weight:500;color:var(--ink);font-size:13.5px}
footer .ft-disc{padding:22px 0;font-size:12.5px;line-height:1.65;color:var(--ink3);max-width:110ch;margin:0}
footer .ft-bottom{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:16px 0 4px;border-top:1px solid var(--line);font-size:12.5px;color:var(--ink3)}
footer .ft-bottom a{color:var(--ink3)}
@media (max-width:900px){footer .ft-grid{grid-template-columns:1fr 1fr}}
@media (max-width:560px){footer .ft-grid{grid-template-columns:1fr;gap:24px}}
</style>'''
def footer(pre):
    nav = [("deals.html", "Deals"), ("how-it-works.html", "How it works"), ("about.html", "About us"), ("founders.html", "List your company"), ("dashboard.html", "Dashboard")]
    explore = ''.join(f'<li><a href="{pre}{h}">{t}</a></li>' for h, t in nav)
    return (f'<footer><div class="wrap"><div class="ft-grid">'
            f'<div class="ft-brand"><a class="logo" href="{pre}index.html"><span class="mk" aria-hidden="true">1</span>Pehla Round</a>'
            f'<p>IPO-bound gems for family offices, checked before you see them.</p><a class="mail" href="mailto:desk@pehlaround.in">desk@pehlaround.in</a></div>'
            f'<div class="ft-col"><h4>Explore</h4><ul>{explore}</ul></div>'
            f'<div class="ft-col"><h4>Operated by</h4><ul><li class="kv"><b>SintraCap Advisors LLP</b>LLPIN ACL-6334</li>'
            f'<li class="kv"><b>Office</b>602 Lodha Supremus, Lower Parel, Mumbai 400013</li>'
            f'<li class="kv"><b>Registered office</b>B/3501, World View, Lodha World Towers, S.B. Marg, Lower Parel, Mumbai 400013</li></ul></div>'
            f'<div class="ft-col"><h4>Legal</h4><ul><li><a href="{pre}legal.html">Terms and privacy</a></li><li><a href="#" data-show-disclaimer>Site disclaimer</a></li>'
            f'<li><a href="mailto:desk@pehlaround.in">Grievances and data protection</a></li></ul></div></div>'
            f'<p class="ft-disc">Pehla Round is a deal desk. It is not a stock exchange, trading platform, broker, merchant banker or investment adviser, and is not registered with SEBI. '
            f'Nothing on this website is an offer or invitation to subscribe for or buy securities. Any offer is made privately, only to identified family offices, through a private placement offer letter or a share purchase agreement under the Companies Act, 2013. '
            f'Deal overviews on this site are anonymised, and all but one are illustrative samples. Investments in unlisted companies are illiquid, may not list on the expected timeline or at all, and can lose their entire value. The desk charges family offices nothing.</p>'
            f'<div class="ft-bottom"><span>© 2026 Pehla Round · SintraCap Advisors LLP</span><span>Mumbai, India</span></div></div></footer>')
for f in FILES:
    h = open(f).read()
    pre = re.search(r'data-root="([^"]*)"', h).group(1) if 'id="root"' in h else ''
    h, n = re.subn(r'<footer><div class="wrap">.*?</footer>', lambda m: footer(pre), h, count=1, flags=re.S)
    if not n: print('no footer', f)
    if 'id="v28"' not in h: h = h.replace('</head>', CSS + '</head>', 1)
    open(f, 'w').write(h)
