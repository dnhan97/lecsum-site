/* Lecsum – dùng offline. Chỉ lưu bản MÃ HOÁ (data/*.bin) và các tệp tĩnh; khoá giải mã không bao giờ nằm trong cache.
   Tệp tĩnh: lấy cache trước; dữ liệu & manifest: lấy mạng trước, mất mạng thì dùng bản đã lưu. */
const VERSION = "lecsum-2026-11-06T12:22";
const STATIC = ["./", "index.html", "style.css", "crypto.js", "study.js", "app.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-180.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("message", (e) => {
  // trang xin lưu sẵn mọi tài liệu để đọc offline
  if (e.data && e.data.type === "prefetch" && Array.isArray(e.data.urls)) {
    caches.open(VERSION).then((c) => Promise.all(e.data.urls.map((u) => fetch(u, { cache: "no-store" })
      .then((r) => r.ok && c.put(u, r)).catch(() => null))))
      .then(() => e.source && e.source.postMessage({ type: "prefetched", count: e.data.urls.length }));
  }
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const path = url.pathname;
  const dynamic = path.includes("/data/") || path.endsWith("keys.json");
  if (dynamic) {
    const key = new Request(url.origin + url.pathname);   // bỏ ?t=… để khớp bản đã lưu
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(key, copy)); }
      return r;
    }).catch(() => caches.match(key).then((r) => r || Response.error())));
  } else {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).then((resp) => {
      if (resp.ok) { const copy = resp.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return resp;
    })));
  }
});
