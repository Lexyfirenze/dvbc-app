// De Voci Belli Chorale — app-shell service worker.
//
// Scope: only the app's own static shell (HTML/JS/CSS/icons). It deliberately
// does NOT touch Supabase API calls, auth, or realtime — those must always hit
// the network so data stays live. Offline audio/PDF downloads are handled
// separately, directly in the app via the Cache Storage API (see App.jsx),
// not through this worker.
//
// IMPORTANT: bump SHELL_CACHE's version suffix (v2, v3, ...) on any deploy
// where you need users' cached shell/assets invalidated. A service worker
// only re-installs when the browser detects this file's bytes changed, so
// touching only App.jsx/other files will NOT trigger an update on its own —
// changing this file (e.g. the version string below) is what does it.

const SHELL_CACHE = "dvbc-shell-v2";
const SHELL_URLS = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("dvbc-shell-") && key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(async () => {
      // Tell every open tab a new version has taken over so it can reload
      // itself and actually show the new code, instead of silently running
      // stale JS until the user manually closes and reopens the app.
      const clientsList = await self.clients.matchAll({ type: "window" });
      clientsList.forEach((client) => client.postMessage({ type: "DVBC_SW_UPDATED" }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle our own static shell. Everything else (Supabase, storage,
  // cross-origin requests, the app's own explicit offline media caches)
  // passes straight through to the network untouched.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/icons/sheets/") || url.pathname.startsWith("/offline-")) return;

  // Full-page navigations: try the network first (so users get fresh content
  // when online), fall back to the cached shell when there's no connection.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets (hashed JS/CSS bundles, images): cache-as-you-go. Serve the
  // cached copy instantly if we have one, and top up the cache in the
  // background whenever the network succeeds.
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
