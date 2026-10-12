#!/usr/bin/env python3
"""v26: 'outline' -> 'overview'/'deal'; no mention of the desk's fee anywhere; shelf heading no longer says registered offices see anonymised deals."""
import re, glob
FILES = sorted(glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('*/*/*.html'))
FEES = [
 (' It is paid a fee by the company or selling shareholder; the fee is stated in each deal room.', ''),
 ('<p><b>How we are paid.</b> The company or selling shareholder pays the desk a fee, disclosed in each deal room.</p>', ''),
 ('<li>The desk\'s fee<span class="v">Stated in room</span></li>', ''),
 ('<path class="farrow fee" d="M840 184 C 840 308, 700 308, 554 308" marker-end="url(#mh)"></path><text class="fs" x="735" y="334" text-anchor="middle">Listing + success fee · paid by the company</text>', ''),
 ('; the company pays the desk a listing and success fee"', '"'),
 ('Nothing. Family offices pay no fee to register, to open a room, or to commit. The desk is paid by the company or the selling shareholder: a listing fee when a round goes on the desk and a success fee when it closes. The amount, and whether it is paid in cash or shares, is stated in each room before you commit.',
  'Nothing. Family offices pay no fee to register, to open a room, or to commit.'),
 (' The desk charges investors nothing. It is paid by the company or the selling shareholder: a listing fee when a round is placed on the desk and a success fee on completion, both disclosed in the deal room.', ' The desk charges investors nothing.'),
 ('<h2>How we are paid, and our conflicts</h2><p>Family offices pay nothing. The company or selling shareholder pays a listing fee when a round goes on the desk and a success fee when it closes; the amount, and whether it is paid in cash or shares, is stated in each room and in the offer letter.</p>',
  '<h2>What it costs a family office</h2><p>Nothing: not to register, not to open a room, not to commit.</p>'),
 ('<li>You pay the desk, investors never do: a listing fee when the round goes on the desk and a success fee on close, in cash or shares, within the limits of the Companies Act and disclosed to every office in the room and in the offer letter.</li>', ''),
 ('No fee for the office: not to register, not to open a room, not to commit. The company pays the desk, and the room says how much.', 'No fee for the office: not to register, not to open a room, not to commit.'),
 ('summary of terms, fee and risks', 'summary of terms and risks'),
 ('<div class="kv"><span>Desk fee</span><b>Paid by the selling shareholders. Amount, and cash or shares, to be stated here before any commitment; commercials are still under discussion.</b></div>', ''),
 ('with a summary of terms, the desk\'s fee and the risks to confirm first.', 'with a summary of terms and the risks to confirm first.'),
 ('Round size, valuation, trailing and forward P/E, the desk\'s fee and the room open after registration, PAN check and the NDA.', 'Round size, valuation, trailing and forward P/E and the room open after registration, PAN check and the NDA.'),
 ('Names, round size, valuation, trailing and forward P/E, the desk\'s fee and the data room open', 'Names, round size, valuation, trailing and forward P/E and the data room open'),
 ('<b>3<!-- -->/<!-- -->10<!-- --> done', '<b>3<!-- --> done'),
]
WORDS = [
 ('<span class="eyebrow">On the desk, in outline</span><h2>What a registered office sees</h2><p>Anonymised outlines only. Round size, valuation, trailing and forward P/E and the room open after registration, PAN check and the NDA. Five of the six outlines below are illustrative samples; the naval defence secondary is a live mandate.</p>',
  '<span class="eyebrow">On the desk</span><h2>Deals open on the desk</h2><p>Shown here without company names. Register, verify your PAN and sign the NDA to see the company, round size, valuation, trailing and forward P/E and the data room.</p>'),
 ('>All outlines<', '>All deals<'), ('← All outlines', '← All deals'), ('>Other outlines<', '>Other deals<'),
 ('<span class="eyebrow">Outlines</span><h1>On the desk, in outline</h1><p>Anonymised outlines in one fixed format.', '<span class="eyebrow">Deals</span><h1>Deals on the desk</h1><p>Every deal in one fixed format, without company names.'),
 ('Five of the six are illustrative samples.', ''),
 ('View sample outline', 'View overview'), ('>Outline<', '>Overview<'),
 ('aria-label="Stage: Outline"', 'aria-label="Stage: Overview"'),
 ('The tracker and the risks are public in outline.', 'The tracker and the risks are public in this overview.'),
 ('behind this outline', 'behind this overview'),
 ('so the shelf shows deals in outline and opens the details to registered investors.', 'so the site shows each deal as an overview without the name, and opens the details to registered investors.'),
 ('That is enough to see the outlines.', 'That is enough to see every deal overview.'),
 ('The shelf in outline opens immediately.', 'Every deal overview opens immediately.'),
 ('shows you the outlines.', 'shows you every deal overview.'),
 ('Deals are shown publicly in outline only.', 'Deals are shown publicly as overviews only, without company names.'),
 ('Deal outlines on this site are anonymised', 'Deal overviews on this site are anonymised'),
 ('Facts from each outline as stated by the company', 'Facts from each deal overview as stated by the company'),
]
for f in FILES:
    h = open(f).read(); o = h
    for a, b in FEES + WORDS: h = h.replace(a, b)
    h = h.replace('<li class="now">Outline</li>', '<li class="now">Overview</li>').replace('<li class="">Outline</li>', '<li class="">Overview</li>')
    h = re.sub(r'<details><summary>So how does the desk make money, and why should I trust its tracker\?</summary>.*?</details>', '', h, flags=re.S)
    if h != o: open(f, 'w').write(h)
# also: sample-overview wording and how-it-works 'memo' label fixed by hand in v26
