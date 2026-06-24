const CACHE_NAME = "budgetbeacon-app-shell-v1";
const APP_SHELL_URLS = [
  "/",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/app-icon-192.png",
  "/app-icon-512.png",
];

const isApiRequest = (url) => url.origin === self.location.origin && url.pathname.startsWith("/api");

const isCacheableStaticRequest = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/assets/") ||
    APP_SHELL_URLS.includes(url.pathname));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (isApiRequest(url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put("/", responseClone);
            });
          }

          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  if (!isCacheableStaticRequest(url)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }

        return response;
      });
    }),
  );
});
