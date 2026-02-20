const CACHE = "keirin-quartet-v1";
const CORE = [
  "/keirin-quartet-kurari/",
  "/keirin-quartet-kurari/index.html",
  "/keirin-quartet-kurari/style.css",
  "/keirin-quartet-kurari/app.js",
  "/keirin-quartet-kurari/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // SPAなのでナビゲーションは index.html を返す（オフラインでも起動できる）
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        cache.put("/keirin-quartet-kurari/index.html", res.clone());
        return res;
      } catch {
        return (await cache.match("/keirin-quartet-kurari/index.html")) || Response.error();
      }
    })());
    return;
  }

  // 画像などはキャッシュ優先
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;

    const res = await fetch(req);
    cache.put(req, res.clone());
    return res;
  })());
});
