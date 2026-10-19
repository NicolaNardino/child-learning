/* The service worker: lets Learn & Play be installed on a phone and still open without internet.
   Every file is fetched fresh from the network when there is one (so updates show up straight away),
   and a copy is kept; offline, the kept copy is used. */
const CACHE = "learn-and-play-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || (e.request.mode === "navigate" ? caches.match("./") : undefined)))
  );
});
