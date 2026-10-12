#!/usr/bin/env python3
"""v24: never state a finite number of checks or tests; no numbering on checks."""
import re, glob
FILES = sorted(glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('*/*/*.html'))
R = [
 ('<span class="k eyebrow">The ten checks, in every room, in this order</span>', ''),
 ('Each one is screened against five published tests and the same ten checks.', 'Each one is screened against our published tests and checked in depth before it gets a room.'),
 ('Five tests decide what gets a room.', 'A few clear tests decide what gets a room.'),
 ('Every room states how the company meets each of the five, with sources.', 'Every room states how the company meets each test, with sources.'),
 ('<h3>Ten checks</h3><p>The same ten checks in the same order for every deal: memorandum, audits, reconciliation, order book, title, promoter background, references, valuation, listing readiness, documents. Risks are written before the numbers.</p>',
  '<h3>Diligence checks</h3><p>A standard set of checks for every deal, from the memorandum, audits and order book to title, promoter background, references and valuation, plus more wherever the company, its sector or its history calls for them. Risks are written before the numbers.</p>'),
 ('>Ten checks<', '>Diligence checks<'),
 ('aria-label="Ten checks: the diligence tracker"', 'aria-label="Diligence checks: the diligence tracker"'),
 ('aria-label="Five tests: most raises fail here"', 'aria-label="Primary diligence: teams, sites, customers"'),
 ('aria-label="Room built: seven panels · Deal summary"', 'aria-label="Room built: data room complete"'),
 ('Everything the desk has: seven panels, every document, every question other offices asked.', 'Everything the desk has: every panel, every document, every question other offices asked.'),
 ('which has seven panels and an Deal summary', 'with every panel and a deal summary'),
 ('the same ten checks for every deal,', 'the same standard checks for every deal,'),
 ('<b>3/10</b> checks done', '<b>3</b> checks done'),
 ('aria-label="4 of 10 checks done"', 'aria-label="4 checks done"'),
 ('that meet five tests:', 'that meet our tests:'),
 ("Indicative only. The desk's five tests, as questions. Five yes answers and the intake call is a formality; three or fewer and the desk will tell you what to fix first.",
  "Indicative only. The desk's tests, as questions. Yes to all of them and the intake call is a formality; otherwise the desk will tell you what to fix first."),
 ('Answer the five questions.', 'Answer the questions.'),
 ('Keep the five tests in mind', 'Keep these tests in mind'),
 ('five tests · 5 working days', 'desk tests · 5 working days'),
 ('<h1>One tracker. Ten checks. The same for every office.</h1>', '<h1>One tracker. The same for every office.</h1>'),
]
for f in FILES:
    h = open(f).read(); o = h
    for a, b in R: h = h.replace(a, b)
    if f in ('index.html', 'diligence.html'):
        h = re.sub(r'<span class="n">\d\d</span>', '', h)
    if f == 'index.html':
        h = h.replace('<li>Documents and mechanics</li></ol>', '<li>Documents and mechanics</li><li>And more, as the company and its sector require</li></ol>')
    if h != o: open(f, 'w').write(h)

# diligence page additions applied once by hand in v24 (management/site visits, competitive landscape, open-ended list)
