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

// Push (Fase 13): exibe notificação; clique abre o link.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    // @ts-expect-error - contexto do service worker
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "CorpServices";
  const options = { body: data.body || "", data: { link: data.link || "/" } };
  // @ts-expect-error - contexto do service worker
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  // @ts-expect-error - contexto do service worker
  event.notification.close();
  const link =
    // @ts-expect-error - contexto do service worker
    (event.notification.data && event.notification.data.link) || "/";
  // @ts-expect-error - contexto do service worker
  event.waitUntil(self.clients.openWindow(link));
});
