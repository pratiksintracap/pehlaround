#!/usr/bin/env python3
"""v22: office vs registered office labels; family-office dashboard (preview with example data)."""
import re, glob

FILES = sorted(glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('*/*/*.html'))
OFF = "602 Lodha Supremus, Lower Parel, Mumbai 400013"
REG = "B/3501, World View, Lodha World Towers, S.B. Marg, Lower Parel, Mumbai 400013"
REPL = [
    (f"LLPIN ACL-6334 · Registered office: {OFF} · desk@pehlaround.in",
     f"LLPIN ACL-6334 · Office: {OFF} · Registered office: {REG} · desk@pehlaround.in"),
    (f"Pehla Round is operated by SintraCap Advisors LLP (LLPIN ACL-6334), {OFF}.",
     f"Pehla Round is operated by SintraCap Advisors LLP (LLPIN ACL-6334), registered office {REG}; office at {OFF}."),
    (f"GSTIN 27AFNFS1139Q1Z8<br>Registered office: {OFF}", f"GSTIN 27AFNFS1139Q1Z8<br>Office: {OFF}<br>Registered office: {REG}"),
    # flow: the NDA lands on the dashboard; "Sign in" opens it; the diary lives inside it
    ('data-next="/room/naval-defence-secondary"', 'data-next="/dashboard"'),
    ('href="diary.html">See the diary', 'href="dashboard.html#Portfolio">See the dashboard'),
]
for f in FILES:
    h = open(f).read()
    for a, b in REPL: h = h.replace(a, b)
    pre = re.search(r'id="root"[^>]*', h) and re.search(r'data-root="([^"]*)"', h).group(1) or ''
    h = h.replace(f'<a class="btn ghost sm hide-xs" href="{pre}register.html">Sign in</a>', f'<a class="btn ghost sm hide-xs" href="{pre}dashboard.html">Sign in</a>')
    h = h.replace(f'<a href="{pre}register.html">Sign in</a>', f'<a href="{pre}dashboard.html">Sign in</a>')
    open(f, 'w').write(h)

# ---------------------------------------------------------------- dashboard
ROWS = [  # slug, sector, structure, target, months, status, round, premoney, pe, ticket, sample
  ("naval-defence-secondary", "Naval defence services and manufacturing", "Pre-IPO secondary", "Sept 2028 · main board", 23, "Room open", "₹50 Cr", "₹1,200 Cr", "35x · 18x", "₹1 Cr", False),
  ("jewellery-pre-ipo", "Jewellery manufacturing and retail", "Pre-IPO primary", "Sept 2028", 23, "Sample", "₹12 Cr", "₹96 Cr", "11x · 8x", "₹50 L", True),
  ("ai-collections-software", "AI-led collections software", "Growth round", "Sept 2028", 23, "Sample", "₹20 Cr", "₹110 Cr", "14x · 9x", "₹50 L", True),
  ("ethanol-distillery-pre-ipo", "Grain-based ethanol and ENA distillery", "Pre-IPO primary", "Jul 2029", 33, "Sample", "₹35 Cr", "₹300 Cr", "10x · 7x", "₹1 Cr", True),
  ("edible-oils-pre-ipo", "Edible oils", "Pre-IPO primary", "Jul 2029", 33, "Sample", "₹50 Cr", "₹200 Cr", "9x · 7x", "₹1 Cr", True),
  ("waste-management-growth-round", "Waste management and composting equipment", "Growth round", "Not scheduled", None, "Not open", "₹25 Cr", "—", "—", "₹50 L", True),
]
def shelf_rows():
    out = ''
    for s, n, st, tg, mo, stat, rs, pm, pe, tk, smp in ROWS:
        pill = f'<span class="pill">{stat}</span>' if smp else '<span class="pill ok">Room open</span>'
        act = (f'<a class="btn sm primary" href="room/{s}.html" data-log="Opened room: {n}">Open room</a>' if not smp
               else f'<a class="btn sm" href="deals/{s}.html">Outline</a>')
        out += (f'<tr data-struct="{st}" data-months="{mo if mo is not None else 999}"><td><input type="checkbox" class="cmpchk" value="{s}" aria-label="Compare {n}"></td>'
                f'<th scope="row">{n}<br>{pill}</th><td>{st}</td><td>{tg}</td><td>{rs}</td><td>{pm}</td><td>{pe}</td><td>{tk}</td>'
                f'<td><div style="display:flex;gap:6px;flex-wrap:wrap">{act}<button type="button" class="btn sm ghost" data-pass="{n}">Pass</button></div></td></tr>')
    return out

MAIN = f'''<main><div class="wrap" style="padding-top:24px;padding-bottom:56px"><div class="room" id="dash">
<div class="roomhead"><div><span class="eyebrow">Office dashboard · preview with example data</span><h1>Mehta Family Office</h1>
<p class="lede">Everything your office does on the desk, in one place: the shelf, the rooms you opened, calls, documents, what you hold, your team, and a log of who saw what.</p>
<ol class="statusrail" id="dash-rail" aria-label="Your status"><li class="done">Registered</li><li class="done">PAN verified</li><li class="done" data-nda>NDA e-signed</li><li class="done">Rooms unlocked</li></ol></div>
<div class="roomside"><div class="kv"><span>Rooms opened</span><b data-k="opened">3</b></div><div class="kv"><span>Shortlisted</span><b data-k="saved">0</b></div>
<div class="kv"><span>Passed</span><b data-k="passed">1</b></div><div class="kv"><span>Allocations</span><b>1 · ₹2 Cr</b></div>
<a class="btn primary" href="room/naval-defence-secondary.html">Open the live room</a></div></div>

<div class="tabs" role="tablist">
<button role="tab" type="button" class="tabbtn" data-tab="Shelf" aria-selected="true">Shelf</button>
<button role="tab" type="button" class="tabbtn" data-tab="Rooms" aria-selected="false">My rooms</button>
<button role="tab" type="button" class="tabbtn" data-tab="Calls" aria-selected="false">Calls</button>
<button role="tab" type="button" class="tabbtn" data-tab="Documents" aria-selected="false">Documents</button>
<button role="tab" type="button" class="tabbtn" data-tab="Portfolio" aria-selected="false">Portfolio</button>
<button role="tab" type="button" class="tabbtn" data-tab="Team" aria-selected="false">Team and profile</button>
<button role="tab" type="button" class="tabbtn" data-tab="Log" aria-selected="false">Activity log</button></div>

<section class="panel" data-panel="Shelf">
<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="k eyebrow">Structure</span>
<button type="button" class="chip" data-f="All" aria-pressed="true">All</button><button type="button" class="chip" data-f="Pre-IPO primary" aria-pressed="false">Pre-IPO primary</button>
<button type="button" class="chip" data-f="Pre-IPO secondary" aria-pressed="false">Pre-IPO secondary</button><button type="button" class="chip" data-f="Growth round" aria-pressed="false">Growth round</button>
<label style="margin-left:auto;font-size:13px">Target listing <select id="f-months" style="margin-left:6px"><option value="999">Any time</option><option value="24">Within 24 months</option><option value="36">Within 36 months</option></select></label></div>
<div class="cmpwrap"><table class="cmp plain" id="shelf-t"><thead><tr><th></th><th>Deal</th><th>Structure</th><th>Target listing</th><th>Round</th><th>Pre-money</th><th>P/E trailing · forward</th><th>Min ticket</th><th></th></tr></thead><tbody>{shelf_rows()}</tbody></table></div>
<p class="fine">Same fields for every deal so offices can compare quickly. Samples are illustrative; only the naval defence secondary is a live mandate. Tick two or more to compare.</p>
<div><button type="button" class="btn" id="cmp-go" disabled>Compare ticked deals</button></div><div class="cmpwrap" id="cmp-out"></div>
</section>

<section class="panel" data-panel="Rooms" hidden>
<div class="two"><div class="chart"><span class="k">Opened</span><ul class="feed" id="r-opened"><li><b>Naval defence secondary</b> · 10 Oct 2026</li><li><b>Jewellery (sample)</b> · 9 Oct 2026</li><li><b>Edible oils (sample)</b> · 8 Oct 2026</li></ul></div>
<div class="chart"><span class="k">Shortlisted</span><ul class="feed" id="r-saved"><li class="empty-li">Nothing yet. Use the bookmark on any deal card.</li></ul></div>
<div class="chart"><span class="k">Passed, with your reason</span><ul class="feed" id="r-passed"><li><b>Edible oils (sample)</b> · "Want the FY26 audit first" · 8 Oct 2026</li></ul></div>
<div class="chart"><span class="k">Committed</span><ul class="feed"><li><b>Naval defence secondary</b> · ₹2 Cr indicated · term sheet received</li></ul></div></div>
</section>

<section class="panel" data-panel="Calls" hidden>
<div class="cmpwrap"><table class="cmp plain"><thead><tr><th>Deal</th><th>Call</th><th>Status</th><th>When</th><th>Summary</th></tr></thead><tbody id="calls-t">
<tr><th scope="row">Naval defence secondary</th><td>Group session with the mandate holder</td><td><span class="pill ok">Held</span></td><td>6 Oct 2026</td><td>Posted to the room for every office</td></tr>
<tr><th scope="row">Naval defence secondary</th><td>Management call requested by your office</td><td><span class="pill">Scheduled</span></td><td>16 Oct 2026, 4:00 pm</td><td>Posted after the call</td></tr></tbody></table></div>
<div class="callbox"><h3>Request a call</h3><p class="fine">Calls are group sessions under the NDA. Nothing that will not appear in the offer documents is shared on a call, and a written summary goes to the room for every office.</p>
<form class="form" id="dcall" novalidate><div class="row"><label>Deal<select name="deal" required><option>Naval defence secondary</option></select></label>
<label>Preferred slot<select name="slot" required><option value="" disabled selected>Select</option><option>Weekday morning</option><option>Weekday afternoon</option><option>Weekday evening</option></select></label></div>
<label>Questions in advance<textarea name="qs" rows="2"></textarea></label><div><button class="btn primary" type="submit">Request call</button></div></form></div>
</section>

<section class="panel" data-panel="Documents" hidden>
<div class="cmpwrap"><table class="cmp plain"><thead><tr><th>Document</th><th>Deal</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>
<tr><th scope="row">Confidentiality undertaking (NDA)</th><td>All deals</td><td><span class="pill ok">E-signed · stamped</span></td><td>10 Oct 2026</td><td><button type="button" class="btn sm" data-doc="NDA">View</button></td></tr>
<tr><th scope="row">KYC pack: PAN, address, authorised signatory, trust deed</th><td>Office</td><td><span class="pill ok">Verified</span></td><td>11 Oct 2026</td><td><button type="button" class="btn sm" data-doc="KYC pack">View</button></td></tr>
<tr><th scope="row">Term sheet</th><td>Naval defence secondary</td><td><span class="pill">Received</span></td><td>12 Oct 2026</td><td><button type="button" class="btn sm" data-doc="Term sheet">View</button></td></tr>
<tr><th scope="row">Share purchase agreement</th><td>Naval defence secondary</td><td><span class="pill">Draft</span></td><td>Expected</td><td></td></tr>
<tr><th scope="row">Demat credit confirmation</th><td>Naval defence secondary</td><td><span class="pill">Pending</span></td><td>On transfer</td><td></td></tr>
<tr><th scope="row">PAS-4 offer letter</th><td>Primary rounds only</td><td><span class="pill">Not applicable</span></td><td>—</td><td></td></tr></tbody></table></div>
<p class="fine">Every document opens watermarked with the viewer's name and office, and every view is written to the activity log.</p>
</section>

<section class="panel" data-panel="Portfolio" hidden>
<div class="two"><div class="chart"><span class="k">Holding · example</span><h3 style="margin:4px 0">Naval defence secondary</h3>
<div class="kv"><span>Allocation</span><b>₹2 Cr at ₹105 a share · ≈1.90 lakh shares</b></div><div class="kv"><span>Structure</span><b>Secondary purchase; shares to the family trust's demat</b></div>
<div class="kv"><span>Target listing</span><b>Sept 2028, main board (company target)</b></div><div class="kv"><span>Lock-in ends</span><b id="lockin">Mar 2029 (six months after listing)</b></div>
<div class="kv"><span>Exit through an IPO offer for sale</span><b>Needs a one-year holding before the DRHP is filed</b></div></div>
<div class="chart"><span class="k">Milestones</span><ol class="dm-list big"><li class="commit"><i></i><span class="mono">Oct 2026</span><div><b>Allocation indicated · term sheet received</b></div></li>
<li class="open"><i></i><span class="mono">Nov 2026</span><div><b>SPA signed · shares credited (expected)</b></div></li><li class="report"><i></i><span class="mono">Q3 FY27</span><div><b>FY26 audit signed (expected)</b></div></li>
<li class="report"><i></i><span class="mono">2028</span><div><b>Merchant banker appointed · DRHP filed (target)</b></div></li><li class="hold"><i></i><span class="mono">Sept 2028</span><div><b>Listing (target)</b></div></li>
<li class="alert"><i></i><span class="mono">Mar 2029</span><div><b>Lock-in ends</b></div></li></ol></div></div>
<div class="chart"><span class="k">Quarterly updates</span><ul class="feed"><li><span class="mono">Oct 2026</span> Information memorandum and mandate holder's answers added to the room.</li></ul><p class="fine">The first quarterly update follows allotment.</p></div>
</section>

<section class="panel" data-panel="Team" hidden>
<div class="two"><div class="chart"><span class="k">Investing entity</span>
<div class="kv"><span>Entity</span><b>Mehta Family Trust (example)</b></div><div class="kv"><span>PAN</span><b>AAATM••••K · verified</b></div>
<div class="kv"><span>Residency</span><b>Resident in India</b></div><div class="kv"><span>KYC</span><b>Complete · 11 Oct 2026</b></div>
<div class="kv"><span>Ticket band</span><b>₹1–2 Cr</b></div>
<span class="k" style="margin-top:8px">Sectors you want alerts on</span><div style="display:flex;gap:6px;flex-wrap:wrap" id="prefs">
<button type="button" class="chip" aria-pressed="true">Defence</button><button type="button" class="chip" aria-pressed="false">Consumer</button><button type="button" class="chip" aria-pressed="true">Manufacturing</button>
<button type="button" class="chip" aria-pressed="false">Financial services</button><button type="button" class="chip" aria-pressed="false">Energy</button></div></div>
<div class="chart"><span class="k">People with access</span><div class="cmpwrap"><table class="cmp plain" style="min-width:0"><thead><tr><th>Name</th><th>Role</th><th>Rights</th></tr></thead><tbody id="team-t">
<tr><th scope="row">R. Mehta</th><td>Principal</td><td>View, comment, commit</td></tr><tr><th scope="row">S. Shah</th><td>CIO</td><td>View, comment</td></tr><tr><th scope="row">A. Jain</th><td>CA to the family</td><td>View</td></tr></tbody></table></div>
<form class="form" id="addv" novalidate style="margin-top:10px"><div class="row"><label>Email<input type="email" name="em" required placeholder="name@office.in"></label>
<label>Rights<select name="r"><option>View</option><option>View, comment</option><option>View, comment, commit</option></select></label></div><div><button class="btn" type="submit">Add viewer</button></div></form></div></div>
<div class="chart"><span class="k">Consents and your data</span><div style="display:grid;gap:8px">
<label class="chk"><input type="checkbox" data-consent="email" checked> Deal alerts by email</label>
<label class="chk"><input type="checkbox" data-consent="wa"> WhatsApp messages about deals</label>
<label class="chk"><input type="checkbox" data-consent="calls"> Calls from the desk</label></div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn sm" id="dl-data">Download my data</button><button type="button" class="btn sm ghost" id="del-data">Request deletion</button></div>
<p class="fine">Grievance and data-protection contact: Pratik Saraogi, Designated Partner, desk@pehlaround.in.</p></div>
</section>

<section class="panel" data-panel="Log" hidden>
<div class="cmpwrap"><table class="cmp"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody id="log-t">
<tr><td>12 Oct 2026, 11:04</td><td>R. Mehta</td><td>Viewed term sheet · naval defence secondary (watermarked)</td></tr>
<tr><td>11 Oct 2026, 18:22</td><td>A. Jain</td><td>Downloaded FY26 provisional financials (watermarked)</td></tr>
<tr><td>10 Oct 2026, 09:41</td><td>R. Mehta</td><td>E-signed the confidentiality undertaking (version 1.2)</td></tr>
<tr><td>10 Oct 2026, 09:38</td><td>R. Mehta</td><td>Accepted the site disclaimer (version 2026-10-12)</td></tr></tbody></table></div>
<p class="fine">The log shows the desk offered each deal only to identified people, which is what the private placement rules require.</p>
</section>
</div></div></main>'''

JS = '''<script>
(function(){
  var d=document.getElementById("dash"); if(!d) return;
  function now(){var t=new Date();return t.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})+", "+t.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});}
  function log(w){var tb=document.getElementById("log-t");var tr=document.createElement("tr");tr.innerHTML="<td></td><td>You</td><td></td>";tr.children[0].textContent=now();tr.children[2].textContent=w;tb.insertBefore(tr,tb.firstChild);}
  function toast(m){var t=document.getElementById("ud-toast");if(!t)return;t.textContent=m;t.classList.add("show");setTimeout(function(){t.classList.remove("show");},2600);}
  function get(k,f){try{var v=localStorage.getItem(k);return v?JSON.parse(v):f;}catch(e){return f;}}
  function set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  // shortlist from the deal cards
  var saved=get("ud_saved",[]), names={};
  document.querySelectorAll("#shelf-t tbody tr").forEach(function(r){names[r.querySelector(".cmpchk").value]=r.querySelector("th").firstChild.textContent;});
  var sv=document.getElementById("r-saved"); if(saved.length){sv.innerHTML="";saved.forEach(function(s){var li=document.createElement("li");li.textContent=names[s]||s;sv.appendChild(li);});}
  var ks=d.querySelector('[data-k="saved"]'); if(ks) ks.textContent=saved.length;
  // shelf filters
  var cur="All", rows=[].slice.call(document.querySelectorAll("#shelf-t tbody tr")), sel=document.getElementById("f-months");
  function apply(){var m=+sel.value;rows.forEach(function(r){r.hidden=!((cur==="All"||r.dataset.struct===cur)&&(+r.dataset.months<=m||m===999));});}
  d.querySelectorAll("[data-f]").forEach(function(c){c.addEventListener("click",function(){d.querySelectorAll("[data-f]").forEach(function(o){o.setAttribute("aria-pressed","false");});c.setAttribute("aria-pressed","true");cur=c.dataset.f;apply();});});
  sel.addEventListener("change",apply);
  // compare
  var go=document.getElementById("cmp-go"), out=document.getElementById("cmp-out");
  function ticked(){return rows.filter(function(r){return r.querySelector(".cmpchk").checked;});}
  d.querySelectorAll(".cmpchk").forEach(function(c){c.addEventListener("change",function(){go.disabled=ticked().length<2;});});
  go.addEventListener("click",function(){var t=ticked(), heads=[].slice.call(document.querySelectorAll("#shelf-t thead th")).map(function(h){return h.textContent;});
    var tb=document.createElement("table");tb.className="cmp";var html="<thead><tr><th></th>";t.forEach(function(r){html+="<th></th>";});html+="</tr></thead><tbody>";
    for(var i=2;i<8;i++){html+="<tr><th scope=row></th>";t.forEach(function(){html+="<td></td>";});html+="</tr>";}
    tb.innerHTML=html+"</tbody>";
    t.forEach(function(r,j){tb.tHead.rows[0].cells[j+1].textContent=r.querySelector("th").firstChild.textContent;});
    for(var i=2;i<8;i++){var row=tb.tBodies[0].rows[i-2];row.cells[0].textContent=heads[i];t.forEach(function(r,j){row.cells[j+1].textContent=r.children[i].textContent;});}
    out.innerHTML="";out.appendChild(tb);log("Compared "+t.length+" deals");});
  // pass with a reason
  d.querySelectorAll("[data-pass]").forEach(function(b){b.addEventListener("click",function(){
    var box=document.createElement("div");box.className="form";box.style.marginTop="8px";
    box.innerHTML='<label>Why are you passing?<select><option>Valuation too rich for us</option><option>Want the audit signed first</option><option>Sector outside our mandate</option><option>Ticket size does not fit</option><option>Listing timeline too far out</option></select></label><div><button type="button" class="btn sm primary">Pass on this deal</button></div>';
    b.parentNode.appendChild(box);b.disabled=true;
    box.querySelector("button").addEventListener("click",function(){var why=box.querySelector("select").value, n=b.dataset.pass;
      var li=document.createElement("li");li.innerHTML="<b></b> · \\u201c<span></span>\\u201d · today";li.querySelector("b").textContent=n;li.querySelector("span").textContent=why;document.getElementById("r-passed").appendChild(li);
      var kp=d.querySelector('[data-k="passed"]');kp.textContent=+kp.textContent+1;box.remove();b.textContent="Passed";log("Passed on "+n+": "+why);toast("Passed. Nobody will call to change your mind.");});});});
  d.querySelectorAll("[data-log]").forEach(function(a){a.addEventListener("click",function(){log(a.dataset.log);});});
  d.querySelectorAll("[data-doc]").forEach(function(b){b.addEventListener("click",function(){log("Viewed "+b.dataset.doc+" (watermarked)");toast("Opens in the watermarked viewer in the live product.");});});
  // calls
  var cf=document.getElementById("dcall"); cf.addEventListener("submit",function(e){e.preventDefault();if(!cf.reportValidity())return;
    var tr=document.createElement("tr");tr.innerHTML='<th scope="row"></th><td>Management call requested by your office</td><td><span class="pill">Requested</span></td><td></td><td>Posted after the call</td>';
    tr.children[0].textContent=cf.deal.value;tr.children[3].textContent=cf.slot.value;document.getElementById("calls-t").appendChild(tr);cf.reset();log("Requested a management call");toast("Requested. The desk proposes a group slot with the company.");});
  // team
  var av=document.getElementById("addv"); av.addEventListener("submit",function(e){e.preventDefault();if(!av.reportValidity())return;
    var tr=document.createElement("tr");tr.innerHTML='<th scope="row"></th><td>Invited</td><td></td>';tr.children[0].textContent=av.em.value;tr.children[2].textContent=av.r.value;document.getElementById("team-t").appendChild(tr);log("Invited "+av.em.value+" ("+av.r.value+")");av.reset();});
  document.querySelectorAll("#prefs .chip").forEach(function(c){c.addEventListener("click",function(){c.setAttribute("aria-pressed",c.getAttribute("aria-pressed")==="true"?"false":"true");});});
  var cons=get("pr_consents",null);
  d.querySelectorAll("[data-consent]").forEach(function(c){if(cons&&c.dataset.consent in cons)c.checked=cons[c.dataset.consent];
    c.addEventListener("change",function(){var o=get("pr_consents",{});o[c.dataset.consent]=c.checked;set("pr_consents",o);log((c.checked?"Gave":"Withdrew")+" consent: "+c.parentNode.textContent.trim());});});
  document.getElementById("dl-data").addEventListener("click",function(){var blob=new Blob([JSON.stringify({office:"Mehta Family Office (example)",shortlist:saved,consents:get("pr_consents",{}),exported:new Date().toISOString()},null,2)],{type:"application/json"});
    var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="pehla-round-my-data.json";document.body.appendChild(a);a.click();a.remove();log("Downloaded the office's data");});
  document.getElementById("del-data").addEventListener("click",function(){log("Requested deletion of the office's data");toast("Deletion request logged. The desk confirms by email, keeping only records the law requires.");});
})();
</script>'''

h = open('diary.html').read()
h = re.sub(r'<main>.*?</main>', lambda m: MAIN, h, count=1, flags=re.S)
h = re.sub(r'<title>.*?</title>', '<title>Dashboard · Pehla Round</title>', h, count=1)
CSS = '<style id="v22">#dash .dm-list b{color:var(--ink)}#dash .dm-list .mono{color:var(--ink3)}#dash .feed li{display:block}#dash .cmp.plain tbody th{font-family:inherit;letter-spacing:0;text-transform:none;color:var(--ink);white-space:normal;width:auto;font-size:14px;font-weight:600}#dash .cmp.plain tbody th .pill{margin-top:4px}#shelf-t{min-width:900px}</style>'
h = h.replace('</head>', CSS + '</head>', 1)
h = h.replace('</body>', JS + '</body>', 1)
open('dashboard.html', 'w').write(h)
print('dashboard written', len(h))
