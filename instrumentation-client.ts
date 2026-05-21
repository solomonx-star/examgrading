// Register the service worker so the app is installable and works offline.
// Only runs in the browser; Next executes this before the app becomes
// interactive.
//
// IMPORTANT: only register in production. In development, Turbopack rewrites
// chunk URLs on every change; a cache-first SW can keep serving stale chunks
// and produce errors like "chunk.reason.enqueueModel is not a function".
// If a SW from a previous session is still installed, actively unregister it
// and purge its caches so dev reloads stay clean.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn("Service worker registration failed:", err);
        });
    });
  } else {
    // Tear down any SW + caches left over from a previous dev session.
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {});
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
    }
  }
}
