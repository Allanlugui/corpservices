/* Service worker mínimo e seguro: ciclo de vida apenas, sem interceptar /api ou navegação.
   Estado PWA: PARCIAL — manifest OK; cache offline real chega na FASE 09. */
self.addEventListener("install", () => {
  // @ts-expect-error - contexto do service worker
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // @ts-expect-error - contexto do service worker
  event.waitUntil(self.clients.claim());
});
