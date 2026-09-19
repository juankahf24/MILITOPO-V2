/* MILITOPO PWA · v50 · arranque oscuro y shell en caché */
const CACHE_NAME = "militopo-pwa-v50-startup-dark";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles.css?v=inicio-premium-v49",
  "./app.js",
  "./app.js?v=inicio-logo-full-v46",
  "./manifest.webmanifest",
  "./icons/militopo-192.png",
  "./icons/militopo-512.png",
  "./icons/militopo-startup-1536.png",
  "./icons/militopo-startup-premium-2048x3072.jpg"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch (e) {}
      }
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(key => key.startsWith("militopo-pwa-") && key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

async function cachedResponse(request) {
  return (await caches.match(request, { ignoreSearch: false })) ||
         (await caches.match(request, { ignoreSearch: true }));
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const isNavigation = request.mode === "navigate";
  const isShellAsset = isNavigation || /\/(?:index\.html|styles\.css|app\.js|manifest\.webmanifest)$/.test(url.pathname);

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cachedResponse(request);
      const networkFetch = async () => {
        try {
          const preload = isNavigation ? await event.preloadResponse : null;
          const response = preload || await fetch(request);
          if (response && response.ok && response.status !== 206) {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        } catch (error) {
          return null;
        }
      };

      if (isShellAsset && cached) {
        event.waitUntil(networkFetch());
        return cached;
      }

      const response = await networkFetch();
      if (response) return response;
      if (cached) return cached;

      if (isNavigation) {
        return (await cachedResponse(new Request("./index.html"))) ||
               (await cachedResponse(new Request("./"))) ||
               new Response(
                 "<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>MILITOPO offline</title><body style='margin:0;font-family:monospace;background:#0a0e0a;color:#f5e6c8;padding:24px'><h1>MILITOPO sin cobertura</h1><p>Abre la app una vez con conexión para dejar guardada la pantalla de inicio.</p></body>",
                 { headers: { "Content-Type": "text/html;charset=utf-8" } }
               );
      }

      return new Response("", { status: 503, statusText: "Offline" });
    })()
  );
});
