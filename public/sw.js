// Hand-rolled service worker. Goals:
//   1. Make the app installable (manifest + scope).
//   2. Keep static Next chunks and icons in cache so the shell loads offline.
//   3. Show a friendly /offline page when navigations fail without network.
//   4. NEVER cache /api/* or auth — user-scoped or private data must stay fresh.
//
// Bump CACHE_VERSION whenever cache contents or strategies change.
const CACHE_VERSION = "v1";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [OFFLINE_URL, "/IAMCOLOGO.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Pre-cache best-effort: ignore individual failures so install never
      // fails the whole SW.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch {
            /* ignore */
          }
        }),
      );
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    /\.(?:css|js|woff2?|ttf|eot|otf|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(
      url.pathname,
    )
  );
}

function isBypass(url) {
  // Never intercept API routes, auth callbacks, or Next data fetches —
  // these are dynamic, user-scoped, or both.
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.startsWith("/_next/image")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isBypass(url)) return;

  // Navigations: network-first, fall back to the offline page if offline.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          return fresh;
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ??
            new Response("Offline", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }
      })(),
    );
    return;
  }

  // Static assets: cache-first with background refresh.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })(),
    );
    return;
  }

  // Anything else same-origin: stale-while-revalidate via the runtime cache,
  // but only if the response is a successful HTML/JSON we can safely store.
  // We don't cache HTML for authenticated pages (no good way to tell from a
  // SW), so this branch ends up mostly inert in practice — kept here so
  // genuinely public GETs added later get cached automatically.
  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});

// Allow the page to force-activate a waiting worker (used after we detect a
// fresh deploy on the client).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
