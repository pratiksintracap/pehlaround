/* Pehla Round: the site's interactive layer. Plain JS on server-rendered markup. */
(function () {
  "use strict";
  function init() {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  function fmtAmt(a) { return a < 1 ? "₹" + Math.round(a * 100) + " L" : "₹" + a + " Cr"; }
  function api(url, body) {
    return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}), credentials: "same-origin" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again."); return j; }); });
  }
  window.__pr = { api: api };
  var DEALS = [];
  try { DEALS = JSON.parse(($("#ud-data") || {}).textContent || "[]"); } catch (e) {}
  var bySlug = function (s) { for (var i = 0; i < DEALS.length; i++) if (DEALS[i].slug === s) return DEALS[i]; return null; };

  /* ---------- toast ---------- */
  var toastEl = $("#ud-toast"), toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }

  /* ---------- theme ---------- */
  (function () {
    var root = document.documentElement, saved = store.get("ud_theme", null);
    if (saved) root.setAttribute("data-theme", saved);
    var btn = $("#theme-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var dark = root.getAttribute("data-theme") === "dark" || (!root.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
      var next = dark ? "light" : "dark";
      root.setAttribute("data-theme", next); store.set("ud_theme", next);
    });
  })();

  /* ---------- counters in the hero ---------- */
  (function () {
    var els = $$(".stat .v");
    if (!els.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    els.forEach(function (el) {
      var node = el.firstChild;
      if (!node || node.nodeType !== 3) return;
      var m = node.nodeValue.match(/^(\D*)(\d+)(.*)$/);
      if (!m) return;
      var pre = m[1], end = +m[2], post = m[3], t0 = null;
      node.nodeValue = pre + "0" + post;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / 1100), e = 1 - Math.pow(1 - p, 3);
        node.nodeValue = pre + Math.round(end * e) + post;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  })();

  /* ---------- shortlist ---------- */
  var saved = store.get("ud_saved", []);
  function isSaved(s) { return saved.indexOf(s) > -1; }
  function paintSaves() {
    $$("[data-save]").forEach(function (b) { b.setAttribute("aria-pressed", isSaved(b.getAttribute("data-save")) ? "true" : "false"); });
    var c = $("#shortlist-count");
    if (c) { c.textContent = String(saved.length); c.hidden = !saved.length; }
    var list = $("#shortlist-list");
    if (list) {
      list.innerHTML = "";
      if (!saved.length) { var li = document.createElement("li"); li.className = "empty-li"; li.textContent = "Nothing saved yet. Use the bookmark on any deal card."; list.appendChild(li); }
      saved.forEach(function (s) {
        var d = bySlug(s); if (!d) return;
        var li = document.createElement("li");
        li.innerHTML = '<a class="s" href="/deals/' + s + '"></a><span class="f"></span><button type="button" class="iconbtn" data-unsave="' + s + '" aria-label="Remove">×</button>';
        li.querySelector(".s").textContent = d.sector;
        li.querySelector(".f").textContent = d.category + " · " + d.listing;
        list.appendChild(li);
      });
      $$("a.s", list).forEach(fixHref);
    }
    var cb = $("#compare-btn"); if (cb) cb.disabled = saved.length < 2;
  }
  // in the static preview, root-relative links must be rewritten the way the snapshot rewrites them
  function fixHref(a) {
    var root = $("#root"); if (!root) return;
    var h = a.getAttribute("href"); if (!h || h.charAt(0) !== "/") return;
    var p = h.replace(/^\//, ""); if (!/\.html/.test(p)) p += ".html";
    a.setAttribute("href", (root.getAttribute("data-root") || "") + p);
  }
  function toggleSave(s) {
    var i = saved.indexOf(s);
    if (i > -1) { saved.splice(i, 1); toast("Removed from your shortlist"); } else { saved.push(s); toast("Saved to your shortlist"); }
    store.set("ud_saved", saved); paintSaves();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-save]");
    if (b) { e.preventDefault(); toggleSave(b.getAttribute("data-save")); return; }
    var u = e.target.closest && e.target.closest("[data-unsave]");
    if (u) { toggleSave(u.getAttribute("data-unsave")); return; }
  });
  var drawer = $("#shortlist"), sbtn = $("#shortlist-btn");
  function openDrawer(o) { if (!drawer) return; drawer.hidden = !o; if (sbtn) sbtn.setAttribute("aria-expanded", o ? "true" : "false"); }
  if (sbtn) sbtn.addEventListener("click", function () { openDrawer(drawer.hidden); });
  if (drawer) {
    $$("[data-close]", drawer).forEach(function (b) { b.addEventListener("click", function () { openDrawer(false); }); });
    var clr = $("#clear-shortlist"); if (clr) clr.addEventListener("click", function () { saved = []; store.set("ud_saved", saved); paintSaves(); });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") openDrawer(false); });
  paintSaves();

  /* ---------- compare ---------- */
  (function () {
    var dlg = $("#compare"), btn = $("#compare-btn"), body = $("#compare-body");
    if (!dlg || !btn || !body) return;
    var ROWS = [
      ["Structure", function (d) { return d.category; }],
      ["Target listing", function (d) { return d.listing; }],
      ["Status", function (d) { return d.status; }]
    ];
    btn.addEventListener("click", function () {
      var ds = saved.map(bySlug).filter(Boolean);
      var t = document.createElement("table"); t.className = "cmp";
      var thead = document.createElement("thead"), tr = document.createElement("tr"); tr.appendChild(document.createElement("th"));
      ds.forEach(function (d) { var th = document.createElement("th"); th.textContent = d.sector; tr.appendChild(th); });
      thead.appendChild(tr); t.appendChild(thead);
      var tb = document.createElement("tbody");
      ROWS.forEach(function (r) {
        var row = document.createElement("tr"), th = document.createElement("th"); th.textContent = r[0]; row.appendChild(th);
        var vals = ds.map(r[1]);
        vals.forEach(function (v) { var td = document.createElement("td"); td.textContent = v; row.appendChild(td); });
        tb.appendChild(row);
      });
      var row = document.createElement("tr"); row.appendChild(document.createElement("th"));
      ds.forEach(function (d) { var td = document.createElement("td"), a = document.createElement("a"); a.className = "btn sm primary"; a.href = "/room/" + d.slug; a.textContent = "Open room"; fixHref(a); td.appendChild(a); row.appendChild(td); });
      tb.appendChild(row); t.appendChild(tb);
      body.innerHTML = ""; body.appendChild(t);
      openDrawer(false); dlg.showModal();
    });
    $$("[data-close]", dlg).forEach(function (b) { b.addEventListener("click", function () { dlg.close(); }); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  })();

  /* ---------- deal room: ticket to stake ---------- */
  (function () {
    var amt = $(".amt"); if (!amt) return;
    var r = $("input[type=range]", amt), out = $("#amtstake"), av = $("#amtval"), price = +amt.getAttribute("data-price"), shares = +amt.getAttribute("data-shares"), post = +amt.getAttribute("data-post");
    if (!r) return;
    function upd() {
      var a = +r.value;
      if (av) av.textContent = fmtAmt(a);
      if (!out) return;
      if (price && shares) out.textContent = "≈ " + ((a * 100) / price).toFixed(2) + " lakh shares at ₹" + price + " · " + ((a / (shares * price)) * 100).toFixed(2) + "% of the company";
      else if (post) out.textContent = "≈ " + ((a / post) * 100).toFixed(2) + "% of the company, post-money";
    }
    r.addEventListener("input", upd); upd();
  })();

  /* ---------- deal room: scenario calculator ---------- */
  (function () {
    var sc = $("#scenario"); if (!sc) return;
    var pat = +sc.getAttribute("data-pat"), shares = +sc.getAttribute("data-shares"), price = +sc.getAttribute("data-price"), months = +sc.getAttribute("data-months");
    var post = +sc.getAttribute("data-post");
    if (!(price && shares) && post) { price = post; shares = 1; } // valuation mode: one "share" is the whole company
    var ins = { ach: $("input[name=ach]", sc), pe: $("input[name=pe]", sc), amt: $("input[name=amt]", sc) };
    var out = function (k) { return $("[data-out=" + k + "]", sc); };
    var fmtCr = function (n) { return n >= 100 ? "₹" + (n / 100).toFixed(2) + " Cr" : "₹" + n.toFixed(1) + " L"; };
    function calc() {
      var ach = +ins.ach.value / 100, pe = +ins.pe.value, amt = +ins.amt.value;
      var mcap = pat * ach * pe;                 // ₹ Cr
      var px = mcap / shares;                    // ₹ per share
      var moic = px / price;
      var irr = Math.pow(moic, 12 / months) - 1;
      var value = amt * moic;                    // ₹ Cr
      out("ach").textContent = Math.round(ach * 100) + "%";
      out("pe").textContent = pe + "x";
      out("amt").textContent = fmtAmt(amt);
      out("value").textContent = "₹" + value.toFixed(2) + " Cr";
      out("vsub").textContent = "on a " + fmtAmt(amt) + " ticket · implied market cap ₹" + Math.round(mcap).toLocaleString("en-IN") + " Cr";
      out("moic").textContent = moic.toFixed(2) + "x";
      out("irr").textContent = (irr * 100).toFixed(1) + "%";
      out("pes").textContent = (price * shares / (pat * ach)).toFixed(1) + "x → " + pe + "x";
      out("exitpx").textContent = post && shares === 1 ? "Exit: ₹" + Math.round(px).toLocaleString("en-IN") + " Cr market cap" : "Exit: ₹" + px.toFixed(0) + " a share";
      var bar = out("bar"); if (bar) { var pct = Math.min(100, (price / Math.max(px, price)) * 100); bar.style.width = (moic >= 1 ? pct : 100) + "%"; bar.className = moic >= 1 ? "" : "down"; }
      sc.classList.toggle("loss", moic < 1);
    }
    Object.keys(ins).forEach(function (k) { if (ins[k]) ins[k].addEventListener("input", calc); });
    calc();
  })();

  /* ---------- deal room: alerts (saved to the office) ---------- */
  (function () {
    var box = $("#alerts"); if (!box) return;
    var slug = box.getAttribute("data-deal");
    $$("[data-alert]", box).forEach(function (b) {
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") !== "true", a = b.getAttribute("data-alert");
        b.setAttribute("aria-pressed", on ? "true" : "false");
        var list = $$("[data-alert]", box).filter(function (x) { return x.getAttribute("aria-pressed") === "true"; }).map(function (x) { return x.getAttribute("data-alert"); });
        api("/api/room/" + slug + "/prefs", { alerts: list }).then(function () { toast((on ? "Alert set: " : "Alert off: ") + a.toLowerCase()); });
      });
    });
  })();

  /* ---------- product flow: click, keys, autoplay ---------- */
  (function () {
    var root = $("#pflow"); if (!root) return;
    var nodes = $$(".pnode", root), panels = $$(".pflow-card", root), dots = $$("[data-dot]", root), pulse = $(".ppulse", root);
    var i = 0, timer = null, playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    function show(n) {
      i = (n + nodes.length) % nodes.length;
      var id = nodes[i].getAttribute("data-node");
      nodes.forEach(function (el) { el.classList.toggle("on", el === nodes[i]); });
      panels.forEach(function (pn) { pn.hidden = pn.getAttribute("data-panel") !== id; });
      dots.forEach(function (d) { d.classList.toggle("on", d.getAttribute("data-dot") === id); });
      if (pulse) { var tr = nodes[i].getAttribute("transform").match(/translate\(([\d.]+),([\d.]+)\)/); if (tr) { pulse.setAttribute("cx", tr[1]); pulse.setAttribute("cy", tr[2]); } }
    }
    function tick() { if (!playing) return; show(i + 1); timer = setTimeout(tick, 2800); }
    function setPlay(p) { playing = p; var b = $("[data-flow=play]", root); if (b) { b.textContent = p ? "Pause" : "Play"; b.setAttribute("aria-pressed", p ? "true" : "false"); } clearTimeout(timer); if (p) timer = setTimeout(tick, 2800); }
    nodes.forEach(function (el, k) {
      el.addEventListener("click", function () { setPlay(false); show(k); });
      el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPlay(false); show(k); } });
    });
    var prev = $("[data-flow=prev]", root), next = $("[data-flow=next]", root), play = $("[data-flow=play]", root);
    if (prev) prev.addEventListener("click", function () { setPlay(false); show(i - 1); });
    if (next) next.addEventListener("click", function () { setPlay(false); show(i + 1); });
    if (play) play.addEventListener("click", function () { setPlay(!playing); });
    root.addEventListener("mouseenter", function () { clearTimeout(timer); });
    root.addEventListener("mouseleave", function () { if (playing) timer = setTimeout(tick, 1800); });
    show(0);
    // only autoplay once the flow is on screen
    if ("IntersectionObserver" in window) {
      var seen = false, io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !seen) { seen = true; setPlay(playing); io.disconnect(); } }); }, { threshold: 0.3 });
      io.observe(root);
    } else setPlay(playing);
  })();

  /* ---------- hero mock: rotating views ---------- */
  (function () {
    var m = $("#heromock"); if (!m) return;
    var tabs = $$(".mtab", m), panes = $$("[data-mpane]", m), dots = $$(".mock-dots i", m), cur = 0, t = null, auto = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    function show(n) {
      cur = (n + panes.length) % panes.length;
      tabs.forEach(function (b, k) { b.setAttribute("aria-selected", k === cur ? "true" : "false"); });
      panes.forEach(function (pn, k) { pn.hidden = k !== cur; });
      dots.forEach(function (d, k) { d.classList.toggle("on", k === cur); });
    }
    function loop() { if (!auto) return; show(cur + 1); t = setTimeout(loop, 4200); }
    tabs.forEach(function (b, k) { b.addEventListener("click", function () { auto = false; clearTimeout(t); show(k); }); });
    m.addEventListener("mouseenter", function () { clearTimeout(t); });
    m.addEventListener("mouseleave", function () { if (auto) t = setTimeout(loop, 2500); });
    if (auto) t = setTimeout(loop, 4200);
  })();

  /* ---------- founders: thirty-second check ---------- */
  (function () {
    var box = $("#fcheck"); if (!box) return;
    var ans = {}, bar = $("[data-fc-bar]", box), out = $("[data-fc-verdict]", box);
    var V = {
      5: "All yes. This is what the desk looks for; the intake call is to confirm the numbers and agree terms.",
      4: "One no. Worth a call: the desk will tell you on the first call whether it can be fixed before the raise.",
      3: "Two no. Not yet. The desk will say which to fix first; most rounds that get a room started here a year earlier.",
      2: "Not a fit for this desk today. Keep these tests in mind and come back when the numbers and the listing plan are real."
    };
    $$("[data-fc]", box).forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-fc"), v = b.getAttribute("data-v");
        ans[k] = v;
        $$("[data-fc=" + k + "]", box).forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        var keys = Object.keys(ans), yes = keys.filter(function (x) { return ans[x] === "yes"; }).length;
        if (bar) { bar.style.width = (yes / 5) * 100 + "%"; bar.className = yes >= 4 ? "good" : yes === 3 ? "mid" : "low"; }
        if (keys.length < 5) out.textContent = yes + " yes so far · " + (5 - keys.length) + " to answer.";
        else out.textContent = V[yes >= 5 ? 5 : yes === 4 ? 4 : yes === 3 ? 3 : 2];
      });
    });
  })();

  /* ---------- deal room: tab deep links and hash updates ---------- */
  (function () {
    var tabs = $$(".tabbtn"); if (!tabs.length) return;
    tabs.forEach(function (t) {
      t.addEventListener("click", function () { try { history.replaceState(null, "", "#" + encodeURIComponent(t.getAttribute("data-tab"))); } catch (e) {} });
    });
    // keyboard: left/right between tabs
    $(".tabs").addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      var i = tabs.indexOf(document.activeElement); if (i < 0) return;
      var n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); n.click();
    });
  })();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* Pehla Round: page chrome, disclaimer, forms and deal-room actions. */
(function () {
  "use strict";
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function api(url, body) {
    return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}), credentials: "same-origin" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again."); return j; }); });
  }
  function toast(msg) { var t = $("#ud-toast"); if (!t) return; t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 2600); }
  function okMsg(form, msg, bad) { var ok = $(".ok", form); if (!ok) { ok = document.createElement("div"); ok.className = "ok"; ok.setAttribute("role", "status"); form.appendChild(ok); } ok.classList.add("show"); ok.classList.toggle("bad", !!bad); ok.textContent = msg; }
  function run() {
    // current page in the nav
    var p = location.pathname.replace(/\/$/, "") || "/";
    $$(".hdr nav a, .mnav-panel a").forEach(function (a) { var h = a.getAttribute("href"); if (h !== "/" && (p === h || p.indexOf(h + "/") === 0)) a.setAttribute("aria-current", "page"); });
    // mobile menu
    var btn = $(".mnav-btn"), panel = $(".mnav-panel");
    if (btn && panel) btn.addEventListener("click", function () { var o = panel.classList.toggle("open"); btn.setAttribute("aria-expanded", o); });
    // reveal on scroll
    var rv = $$(".rv:not(.inview)");
    if (rv.length) {
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("inview"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -40px 0px" });
        rv.forEach(function (el) { io.observe(el); });
      } else rv.forEach(function (el) { el.classList.add("inview"); });
    }
    // tabs (deal room, dashboard)
    $$(".tabbtn").forEach(function (t) { t.addEventListener("click", function () {
      $$(".tabbtn").forEach(function (o) { o.setAttribute("aria-selected", "false"); }); t.setAttribute("aria-selected", "true");
      var n = t.getAttribute("data-tab"); $$(".panel").forEach(function (pn) { pn.hidden = pn.getAttribute("data-panel") !== n; }); }); });
    (function () { var h = decodeURIComponent(location.hash.slice(1)); var t = h && $('.tabbtn[data-tab="' + h.replace(/"/g, "") + '"]'); if (t) t.click(); })();

    // ---------- disclaimer gate ----------
    var VER = "2026-10-12", KEY = "pr_disclaimer", g = $("#disc-gate");
    function get() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
    function set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
    function show() { if (!g) return; g.hidden = false; document.body.classList.add("disc-open"); var a = $("#disc-agree"); if (a) a.focus({ preventScroll: true }); var c = $(".disc-card", g); if (c) c.scrollTop = 0; }
    function hide() { if (!g) return; g.hidden = true; document.body.classList.remove("disc-open"); }
    var rec = get(), fresh = rec && rec.v === VER && (Date.now() - rec.at) < 30 * 864e5;
    if (!fresh) show();
    var ag = $("#disc-agree"); if (ag) ag.addEventListener("click", function () { set({ v: VER, at: Date.now() }); hide(); if (document.body.getAttribute("data-user")) api("/api/disclaimer", { version: VER }).catch(function () {}); });
    var lv = $("#disc-leave"); if (lv) lv.addEventListener("click", function () { if (history.length > 1) history.back(); else location.replace("about:blank"); });
    $$("[data-show-disclaimer]").forEach(function (x) { x.addEventListener("click", function (e) { e.preventDefault(); show(); }); });
    if (g) g.addEventListener("keydown", function (e) { if (e.key === "Tab") { var f = $$("button", g); if (!f.length) return; var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } });
    try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) {}
    if (!location.hash) window.scrollTo(0, 0);

    // ---------- shelf filters (deals page) ----------
    var chips = $$(".filters .chip"), cards = $$(".shelf .card");
    if (chips.length && cards.length) {
      var cat = "All";
      chips.forEach(function (ch) { ch.addEventListener("click", function () {
        chips.forEach(function (o) { o.setAttribute("aria-pressed", "false"); }); ch.setAttribute("aria-pressed", "true"); cat = ch.getAttribute("data-cat") || ch.textContent.trim();
        var shown = 0; cards.forEach(function (c) { var ok = cat === "All" || c.getAttribute("data-cat") === cat; c.hidden = !ok; if (ok) shown++; });
        var e = $(".empty"); if (e) e.hidden = shown > 0; }); });
    }

    // ---------- founders: intake form ----------
    var fo = $("#founder");
    if (fo) fo.addEventListener("submit", function (e) {
      e.preventDefault(); if (!fo.reportValidity()) return;
      var b = $("button[type=submit]", fo), data = {};
      $$("input,select,textarea", fo).forEach(function (el) { if (el.name) data[el.name] = el.type === "checkbox" ? (el.checked ? "yes" : "no") : el.value; });
      if (b) { b.disabled = true; b.textContent = "Sending…"; }
      api("/api/leads", data).then(function () { if (b) b.textContent = "Sent"; okMsg(fo, "Received. A banker from the desk will call within two working days."); })
        .catch(function (err) { if (b) { b.disabled = false; b.textContent = "Send"; } okMsg(fo, err.message, true); });
    });

    // ---------- deal room ----------
    var room = $(".room[data-room]"); if (!room) return;
    var slug = room.getAttribute("data-room"), base = "/api/room/" + slug + "/";
    // allocation request
    var rq = $("[data-request]");
    if (rq) rq.addEventListener("click", function () {
      var r = $(".amt input[type=range]"), co = $("input[name=colead]");
      rq.disabled = true; rq.textContent = "Sending…";
      api(base + "interest", { amount: r ? +r.value : null, colead: !!(co && co.checked) })
        .then(function () { rq.textContent = "Request sent"; toast("Allocation request sent to the desk"); })
        .catch(function (err) { rq.disabled = false; rq.textContent = "Request allocation"; toast(err.message); });
    });
    // pass
    var pf = $(".passform");
    if (pf) pf.addEventListener("submit", function (e) {
      e.preventDefault(); var why = pf.why.value; if (!why) { pf.why.focus(); return; }
      var b = $("[data-pass]", pf); b.disabled = true;
      api(base + "pass", { reason: why, note: pf.note.value }).then(function () { b.textContent = "Passed. Noted in your dashboard"; toast("Passed. Nobody will call."); })
        .catch(function (err) { b.disabled = false; toast(err.message); });
    });
    // question to the promoter
    var ask = $(".askform");
    if (ask) ask.addEventListener("submit", function (e) {
      e.preventDefault(); var ta = $("textarea", ask), q = ta && ta.value.trim(); if (!q) return;
      var b = $("button", ask); b.disabled = true;
      api(base + "question", { question: q }).then(function () {
        var li = document.createElement("li"); li.innerHTML = '<b></b><p class="fine">Submitted just now. Awaiting the promoter; the answer will appear here for every office in this room.</p>';
        $("b", li).textContent = q; var list = $(".qa"); if (list) list.appendChild(li); ta.value = ""; b.disabled = false; toast("Question sent");
      }).catch(function (err) { b.disabled = false; toast(err.message); });
    });
    // management call
    var cf = $("#callform");
    if (cf) cf.addEventListener("submit", function (e) {
      e.preventDefault(); if (!cf.reportValidity()) return; var b = $("button[type=submit]", cf); b.disabled = true;
      api(base + "call", { slot: cf.slot.value, who: cf.who.value, qs: cf.qs.value }).then(function () { b.textContent = "Requested";
        okMsg(cf, "Requested. The desk proposes a group slot with the company and posts the written summary to this room for every office."); })
        .catch(function (err) { b.disabled = false; okMsg(cf, err.message, true); });
    });
    // the office's own checklist
    var ticks = $$(".mine input[type=checkbox]");
    ticks.forEach(function (c) { c.addEventListener("change", function () {
      var on = ticks.filter(function (x) { return x.checked; }); var s = $(".mine h3 small"); if (s) s.textContent = on.length + "/" + ticks.length;
      api(base + "prefs", { ticks: on.map(function (x) { return x.getAttribute("data-tick"); }) }).catch(function () {}); }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();

/* Forms that post to the API: JSON with inline errors, plain POST without JavaScript. */
(function () {
  "use strict";
  function run() {
    Array.prototype.forEach.call(document.querySelectorAll("form[data-api]"), function (f) {
      f.addEventListener("submit", function (e) {
        e.preventDefault(); if (!f.reportValidity()) return;
        var b = f.querySelector("button[type=submit]"), label = b ? b.textContent : "", data = {};
        Array.prototype.forEach.call(f.elements, function (el) { if (!el.name) return; data[el.name] = el.type === "checkbox" ? el.checked : el.value; });
        if (b) { b.disabled = true; b.textContent = "Please wait…"; }
        fetch(f.getAttribute("action"), { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(data), credentials: "same-origin" })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again."); return j; }); })
          .then(function (j) { location.href = j.next || "/dashboard"; })
          .catch(function (err) {
            if (b) { b.disabled = false; b.textContent = label; }
            var ok = f.querySelector(".ok"); if (!ok) { ok = document.createElement("div"); ok.className = "ok"; ok.setAttribute("role", "alert"); f.insertBefore(ok, f.firstChild); }
            ok.className = "ok show bad"; ok.textContent = err.message; ok.scrollIntoView({ block: "nearest" });
          });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-print]"), function (b) { b.addEventListener("click", function () { window.print(); }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();

/* Disclaimer "read in full" on phones; About: filter past transactions. */
(function () {
  function run() {
    var m = document.querySelector(".disc-more");
    if (m) m.addEventListener("click", function () { var c = m.closest(".disc-card"); c.classList.add("full"); m.setAttribute("aria-expanded", "true"); });
    var chips = document.querySelectorAll("[data-txf]"), stones = document.querySelectorAll(".stone[data-txt]");
    Array.prototype.forEach.call(chips, function (ch) { ch.addEventListener("click", function () {
      var f = ch.getAttribute("data-txf");
      Array.prototype.forEach.call(chips, function (o) { o.setAttribute("aria-pressed", o === ch ? "true" : "false"); });
      Array.prototype.forEach.call(stones, function (s) { s.hidden = !(f === "All" || s.getAttribute("data-txt") === f); });
    }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
