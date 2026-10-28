// Dumbo service worker: app shell works offline. Bump VERSION when you deploy changes.
const VERSION = "dumbo-v2";
const SHELL = ["./", "index.html", "styles.css", "app.js", "engine.js", "cards.js", "manifest.webmanifest", "icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Network first so deploys show up immediately; fall back to cache offline.
  e.respondWith(
    fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(m => m || caches.match("index.html")))
  );
});
