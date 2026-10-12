#!/usr/bin/env python3
"""v29: one NDA per company. Each NDA is between the family office and that company, and opens that company's room only."""
import re, glob
FILES = sorted(glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('*/*/*.html'))
NDA_MAIN = '''<main><div class="wrap split" style="padding:clamp(40px,6vw,72px) var(--gutter)"><div class="rv inview"><ol class="stepper" aria-label="Step 2 of 3"><li class="done"><span class="dot">✓</span><span class="t">Register the office</span><span class="s">one form</span></li><li class="now"><span class="dot">2</span><span class="t">PAN and this deal's NDA</span><span class="s">verify and e-sign</span></li><li class=""><span class="dot">3</span><span class="t">This company's room</span><span class="s">at once</span></li></ol><span class="eyebrow">Non-disclosure agreement · Naval defence secondary</span><h1>An NDA with this company, for this deal</h1><p class="lede">Every deal on the desk has its own NDA, signed directly between your family office and that company. This one opens the naval defence secondary's room and nothing else; another deal needs its own NDA with its own company.</p><div class="nda-text"><p><strong>Agreement</strong> between the company behind this deal (“the Company”), named in full in the agreement you e-sign, and the family office named at registration (“the Office”). Pehla Round, operated by SintraCap Advisors LLP, facilitates the agreement and hosts the data room.</p><ol><li><strong>Confidential information.</strong> The Company's name, financial information, valuation, documents, promoter sessions, questions and answers, and the identity of other investors in this round are confidential, whether marked or not.</li><li><strong>Use.</strong> The Office uses it only to evaluate an investment by the Office in the Company.</li><li><strong>Sharing.</strong> The Office may share it with its principals, employees and professional advisers who need it for that evaluation and are bound by the same obligations. It will not forward, copy or publish it, and will not share it with another investor or intermediary.</li><li><strong>No dealing.</strong> Where the Company has listed securities, the Office will not deal in them on the basis of unpublished price-sensitive information received in the room.</li><li><strong>Records.</strong> The room logs what the Office opens, to keep the records that private placement law requires. Documents are watermarked with the viewer's name.</li><li><strong>Scope.</strong> This agreement covers the Company only. It gives no access to any other deal or company on the desk.</li><li><strong>Duration.</strong> Three years from each disclosure, or until the information becomes public through no fault of the Office.</li></ol></div></div><div class="rv inview" style="--d:.1s"><form class="form" id="nda" data-next="/room/naval-defence-secondary" novalidate=""><label>PAN of the investing entity<input required="" pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" placeholder="ABCDE1234F" style="text-transform:uppercase" name="pan"><span class="hint">Checked against the name on PAN before the room opens. Never shown to the company or other offices.</span></label><label>Full name, as on PAN<input required="" autocomplete="name" name="sig"></label><label class="chk"><input type="checkbox" required="" name="agree">I have read this agreement and sign it on behalf of the family office named at registration.</label><div><button class="btn primary" type="submit">Verify PAN and e-sign this NDA</button></div><p class="fine">In the live product each NDA is e-signed with Aadhaar or a DSC and stamped. Signing records your name, the time, the deal and the agreement version; a copy goes to you and to the company. This preview only simulates the step.</p></form></div></div></main>'''
R = [
 ('No fee for family offices, on any deal. One registration, PAN check and NDA open every room on the desk.', 'No fee for family offices, on any deal. Register once; each company\'s room opens with its own NDA.'),
 ('One confidentiality undertaking covers every deal you open.', 'Each deal has its own NDA, signed directly with that company; it opens that company\'s room only.'),
 ('Add your CIO, CFO or CA as viewers; one NDA covers the office.', 'Add your CIO, CFO or CA as viewers; each deal\'s NDA covers your office\'s team for that deal.'),
 ('>one signature, every deal<', '>one per company<'),
 ('aria-label="Sign the NDA: one signature, every deal"', 'aria-label="Sign the NDA: one per company"'),
 ('A single confidentiality undertaking, e-signed (Aadhaar or DSC) and stamped, covers every room you open on the desk, now and later.',
  'An NDA between your office and the company, e-signed (Aadhaar or DSC) and stamped, for each deal you want to open. It opens that company\'s room and nothing else.'),
 ('<span class="eyebrow">Your office<!-- --> · <!-- -->One signature</span>', '<span class="eyebrow">Your office<!-- --> · <!-- -->One NDA per company</span>'),
 ('Company names, numbers and documents, from this point on.', 'That company\'s name, numbers and documents.'),
 ('The room opens the moment the undertaking is signed.', 'The room opens the moment that company\'s NDA is signed.'),
 ('One e-signed undertaking covers every deal you open on the desk.', 'For each deal, an NDA directly with that company. It opens that company\'s room only.'),
 ('Verify PAN, e-sign the NDA', 'Verify PAN, e-sign the deal\'s NDA'),
 ('The company\'s name, numbers, documents and promoter Q&amp;A open after one registration and one confidentiality undertaking, both on screen. No call with us is needed.',
  'The company\'s name, numbers, documents and promoter Q&amp;A open after registration and an NDA signed directly with this company, both on screen. No call with us is needed.'),
 ('Already registered: sign the NDA', 'Already registered: sign this deal\'s NDA'),
 ('Register, verify your PAN and sign the NDA to see the company,', 'Register, verify your PAN and sign that company\'s NDA to see the company,'),
 ('in the same structured deal room, after an e-signed NDA.', 'in the same structured deal room, after an NDA signed with that company.'),
 ('who have accepted a confidentiality undertaking, in line with Section 42', 'who have signed an NDA with that company, in line with Section 42'),
 ('and accepts a confidentiality undertaking.', 'and signs an NDA with each company whose room it opens.'),
 ('after the PAN check and NDA.', 'after the PAN check and that company\'s NDA.'),
 ('It opens with registration and the confidentiality undertaking.', 'It opens with registration.'),
 ('<th scope="row">Confidentiality undertaking (NDA)</th><td>All deals</td>', '<th scope="row">NDA with the company</th><td>Naval defence secondary</td>'),
 ('E-signed the confidentiality undertaking (version 1.2)', 'E-signed the NDA with the naval defence secondary company'),
 ('<li class="done" data-nda>NDA e-signed</li>', '<li class="done" data-nda>NDA per deal</li>'),
 ('<li>NDA e-signed</li>', '<li>NDA per deal</li>'),
 ('<span class="t">PAN and NDA</span><span class="s">verify and e-sign</span>', '<span class="t">PAN and deal NDA</span><span class="s">one NDA per company</span>'),
 ('<title>Confidentiality undertaking · Pehla Round</title>', '<title>Deal NDA · Pehla Round</title>'),
]
for f in FILES:
    h = open(f).read(); o = h
    for a, b in R: h = h.replace(a, b)
    if f == 'nda.html':
        h = re.sub(r'<main>.*?</main>', lambda m: NDA_MAIN, h, count=1, flags=re.S)
    if h != o: open(f, 'w').write(h)
# v29 also: register success message and redirect to dashboard (script edit)
