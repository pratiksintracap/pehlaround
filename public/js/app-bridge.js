/* Before the Bell app: the native layer. Loaded only inside the iPhone/Android app (its user agent carries
   "BeforeTheBellApp"). Push notifications, Face ID / fingerprint sign-in, the share sheet, and documents and
   outside links in the phone's own viewer. Every piece fails quietly: the site underneath always works. */
(function () {
  "use strict";
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var plat = C.getPlatform(), SERVER = "beforethebell.in";
  var P = function (n) { try { return (C.Plugins && C.Plugins[n]) || (C.registerPlugin && C.registerPlugin(n)); } catch (e) { return null; } };
  var Push = P("FirebaseMessaging"), Bio = P("NativeBiometric"), Share = P("Share"), Browser = P("Browser"), App = P("App"), Files = P("Filesystem"), Opener = P("FileOpener");
  var signedIn = !!document.body.getAttribute("data-user");
  var ls = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };
  var post = function (url, body, method) {
    return fetch(url, { method: method || "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body), credentials: "same-origin" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "Something went wrong."); return j; }); });
  };
  var bioName = plat === "ios" ? "Face ID" : "fingerprint";

  // ---------- feel like an app: a loading bar between screens, pull down to refresh ----------
  var bar = document.createElement("div"); bar.className = "nav-bar"; document.body.appendChild(bar);
  var root = document.documentElement;
  function loading() { root.classList.add("navigating"); }
  // Links that stay inside the app start the bar straight away (a tap feels answered even on a slow network).
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]"); if (!a || e.defaultPrevented) return;
    var h = a.getAttribute("href"); if (!h || h.charAt(0) === "#" || a.target === "_blank" || a.hasAttribute("download")) return;
    try { var u = new URL(a.href, location.href); if (u.host !== location.host || (u.pathname === location.pathname && u.search === location.search && u.hash)) return; } catch (x) { return; }
    loading();
    var tab = a.closest(".appbar"); if (tab) { Array.prototype.forEach.call(tab.querySelectorAll("a"), function (x) { x.removeAttribute("aria-current"); }); a.setAttribute("aria-current", "page"); }
  });
  document.addEventListener("submit", function (e) { if (!e.defaultPrevented) loading(); });
  // Coming back with the Back gesture shows the page from memory: clear the bar.
  window.addEventListener("pageshow", function () { root.classList.remove("navigating"); });

  var ptr = document.createElement("div"); ptr.className = "ptr"; ptr.setAttribute("aria-hidden", "true");
  ptr.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>'; document.body.appendChild(ptr);
  var y0 = null, pull = 0, MAX = 90;
  document.addEventListener("touchstart", function (e) {
    if (window.scrollY > 0 || e.touches.length !== 1 || document.querySelector("dialog[open], .ig-open, .sheet-open")) { y0 = null; return; }
    y0 = e.touches[0].clientY; pull = 0;
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (y0 == null) return;
    pull = Math.max(0, Math.min(MAX, (e.touches[0].clientY - y0) * 0.5));
    if (window.scrollY > 0) { pull = 0; }
    ptr.style.opacity = String(pull / MAX); ptr.style.transform = "translateY(" + (pull - 40) + "px) rotate(" + pull * 3 + "deg)";
  }, { passive: true });
  document.addEventListener("touchend", function () {
    if (y0 == null) return; y0 = null;
    if (pull >= MAX * 0.8) { ptr.classList.add("go"); ptr.style.opacity = "1"; ptr.style.transform = "translateY(" + (MAX * 0.6 - 40) + "px)"; loading(); location.reload(); return; }
    ptr.style.transition = "transform .2s, opacity .2s"; ptr.style.opacity = "0"; ptr.style.transform = "translateY(-40px)";
    setTimeout(function () { ptr.style.transition = ""; }, 220);
  }, { passive: true });

  // ---------- push notifications ----------
  function registerPush() {
    if (!Push || !signedIn) return;
    Push.requestPermissions().then(function (p) {
      if (p.receive !== "granted") return;
      return Push.getToken().then(function (t) {
        if (!t || !t.token) return;
        if (ls.get("btb-push") === t.token + "|" + document.body.getAttribute("data-user")) return; // already reported
        return post("/api/app/device", { token: t.token, platform: plat, deviceId: ls.get("btb-bio-id") || undefined })
          .then(function () { ls.set("btb-push", t.token + "|" + document.body.getAttribute("data-user")); });
      });
    }).catch(function () {});
  }
  if (Push) {
    // Tapping a notification opens the page it points to.
    Push.addListener("notificationActionPerformed", function (e) {
      var link = e && e.notification && e.notification.data && e.notification.data.link;
      if (link && link.charAt(0) === "/") location.href = link;
    });
    Push.addListener("tokenReceived", function () { ls.set("btb-push", null); registerPush(); });
  }
  // Ask for notifications only once someone is signed in, never on the sign-in screen.
  if (signedIn) setTimeout(registerPush, 1200);
  // Signing out: stop pushes to this phone (Face ID sign-in stays, as in a banking app).
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href="/logout"]'); if (!a || !Push) return;
    var t = (ls.get("btb-push") || "").split("|")[0]; if (!t) return;
    e.preventDefault(); ls.set("btb-push", null);
    post("/api/app/device", { token: t }, "DELETE").catch(function () {}).then(function () { location.href = "/logout"; });
  }, true);

  // ---------- Face ID / fingerprint sign-in ----------
  function bioAvailable() { return Bio ? Bio.isAvailable().then(function (r) { return !!(r && r.isAvailable); }).catch(function () { return false; }) : Promise.resolve(false); }
  function bioSignIn(btn) {
    var next = (document.querySelector('.lp-form input[name=next]') || {}).value || "/dashboard";
    if (btn) btn.disabled = true;
    return Bio.verifyIdentity({ reason: "Sign in to Before the Bell", title: "Sign in", subtitle: "Before the Bell" })
      .then(function () { return Bio.getCredentials({ server: SERVER }); })
      .then(function (c) { return post("/api/app/biometric/unlock", { deviceId: c.username, secret: c.password, next: next }); })
      .then(function (j) { location.href = j.next || "/dashboard"; })
      .catch(function (err) {
        if (btn) btn.disabled = false;
        var m = err && err.message || "";
        if (/turned off|once more/i.test(m)) { ls.set("btb-bio-id", null); Bio.deleteCredentials({ server: SERVER }).catch(function () {}); if (btn) btn.remove(); }
        if (m && !/cancel|user/i.test(m)) toast(m);
      });
  }
  var lf = document.querySelector(".lp-form");
  if (lf && ls.get("btb-bio-id")) bioAvailable().then(function (ok) {
    if (!ok) return;
    var b = document.createElement("button"); b.type = "button"; b.className = "btn primary bio-btn";
    b.textContent = "Sign in with " + bioName;
    b.addEventListener("click", function () { bioSignIn(b); });
    lf.parentNode.insertBefore(b, lf);
    bioSignIn(b); // offer it straight away when the app opens on the sign-in screen
  });
  // Once signed in, offer Face ID once (and again only if they never answered).
  if (signedIn && !ls.get("btb-bio-id") && !ls.get("btb-bio-asked")) bioAvailable().then(function (ok) {
    if (!ok) return;
    setTimeout(function () {
      sheet("Sign in with " + bioName + " next time?", "Open the app and you are in, without an emailed code. You can turn it off any time by signing out everywhere.",
        "Turn on " + bioName, function () {
          return Bio.verifyIdentity({ reason: "Turn on " + bioName + " sign-in", title: "Turn on " + bioName })
            .then(function () { return post("/api/app/biometric/enroll", { platform: plat, pushToken: (ls.get("btb-push") || "").split("|")[0] || undefined, name: navigator.userAgent.match(/\(([^;)]+)/) ? RegExp.$1 : plat }); })
            .then(function (j) { return Bio.setCredentials({ username: String(j.deviceId), password: j.secret, server: SERVER }).then(function () { ls.set("btb-bio-id", String(j.deviceId)); toast(bioName + " sign-in is on"); }); });
        });
      ls.set("btb-bio-asked", "1");
    }, 2500);
  });

  // A small bottom sheet (no browser dialogs inside the app).
  function sheet(title, body, yes, onYes) {
    var s = document.createElement("div"); s.className = "app-sheet"; s.setAttribute("role", "dialog"); s.setAttribute("aria-label", title);
    s.innerHTML = '<div class="as-card"><b></b><p></p><div class="as-acts"><button type="button" class="btn primary" data-y></button><button type="button" class="btn" data-n>Not now</button></div></div>';
    s.querySelector("b").textContent = title; s.querySelector("p").textContent = body; s.querySelector("[data-y]").textContent = yes;
    var close = function () { s.classList.remove("on"); setTimeout(function () { s.remove(); }, 250); };
    s.querySelector("[data-n]").addEventListener("click", close);
    s.querySelector("[data-y]").addEventListener("click", function () { Promise.resolve(onYes()).then(close, function (e) { close(); if (e && e.message && !/cancel/i.test(e.message)) toast(e.message); }); });
    document.body.appendChild(s); requestAnimationFrame(function () { s.classList.add("on"); });
  }
  function toast(msg) { var t = document.getElementById("ud-toast"); if (!t) return; t.textContent = msg; t.classList.add("show"); setTimeout(function () { t.classList.remove("show"); }, 2600); }

  // ---------- share sheet (Android's web view has no navigator.share) ----------
  if (Share) navigator.share = function (d) { return Share.share({ title: d && d.title, text: d && d.text, url: d && d.url, dialogTitle: "Share" }); };

  // ---------- documents open in the phone's own viewer; outside links in an in-app browser ----------
  // A room document needs the signed-in session, so the app fetches it here and hands the file to the viewer.
  function openDoc(url, a) {
    var label = a.textContent; a.setAttribute("aria-busy", "true");
    return fetch(url, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("The document could not be opened.");
      var type = (r.headers.get("content-type") || "application/pdf").split(";")[0];
      var cd = r.headers.get("content-disposition") || "", m = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(cd);
      var name = (m ? decodeURIComponent(m[1]) : (label || "document").trim().slice(0, 60) + (type === "application/pdf" ? ".pdf" : "")).replace(/[^\w.\- ]+/g, "_");
      return r.blob().then(function (b) { return new Promise(function (ok, no) { var fr = new FileReader(); fr.onload = function () { ok({ data: String(fr.result).split(",")[1], type: type, name: name }); }; fr.onerror = no; fr.readAsDataURL(b); }); });
    }).then(function (f) {
      return Files.writeFile({ path: "docs/" + f.name, data: f.data, directory: "CACHE", recursive: true })
        .then(function (w) { return Opener.open({ filePath: w.uri, contentType: f.type, openWithDefault: true }); });
    }).catch(function (err) { toast(err && err.message || "The document could not be opened."); })
      .then(function () { a.removeAttribute("aria-busy"); });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]"); if (!a || e.defaultPrevented) return;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.protocol === "mailto:" || u.protocol === "tel:" || u.protocol === "whatsapp:") return; // the system handles these
    var same = u.host === location.host;
    if (same && /^\/api\/(docs|room\/[^/]+\/databank)\b/.test(u.pathname) && Files && Opener) { e.preventDefault(); openDoc(u.href, a); return; }
    if (!same && Browser) { e.preventDefault(); Browser.open({ url: u.href, presentationStyle: "popover" }).catch(function () { location.href = u.href; }); return; }
    if (same && a.target === "_blank") { e.preventDefault(); location.href = u.href; }
  });

  // Android back button: back through the pages, and out of the app from the first one.
  if (App && plat === "android") App.addListener("backButton", function (ev) { if (ev && ev.canGoBack) history.back(); else App.exitApp(); });
})();
