/* Before the Bell app: caches the site's static files for speed and shows an offline page.
   Pages with office data are never stored on the device. */
const V = "btb-v2";
const STATIC = ["/offline", "/icon-192.png", "/icon-512.png", "/js/site.js?v=45"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (r.mode === "navigate") { e.respondWith(fetch(r).catch(() => caches.match("/offline"))); return; }
  if (u.pathname.startsWith("/_next/static/") || u.pathname.startsWith("/fonts/") || /\.(png|jpg|svg|ico|woff2)$/.test(u.pathname)) {
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; })));
  }
});
