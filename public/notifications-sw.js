/* No app or API responses are cached: inbox content always uses authenticated requests. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
// Every push shows a notification at once. Phones penalise a push that shows
// nothing (Android posts a generic notice, iPhone ends the subscription), and
// a network check first is slow or fails on a sleeping tablet. The server
// already stops sending once a transfer is acknowledged.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = (event.data ? event.data.json() : null) || {};
  } catch {
    data = {};
  }
  const lang = data.lang === "fa" ? "fa" : "en";
  let url = new URL("/notifications", self.location.origin);
  try {
    const target = new URL(data.url || "/notifications", self.location.origin);
    if (target.origin === self.location.origin) url = target;
  } catch {
    /* Keep the inbox. */
  }
  const title =
    data.title || (lang === "fa" ? "BUZZ · اعلان جدید" : "BUZZ · New alert");
  const options = {
    body: data.body || "",
    icon: "/logo.jpeg",
    badge: "/logo.jpeg",
    lang,
    dir: lang === "fa" ? "rtl" : "ltr",
    vibrate: [200, 100, 200],
    data: { url: url.pathname + url.search },
    // One notification per transfer: a reminder replaces it and rings again.
    ...(data.id
      ? { tag: `transfer:${data.id}`, renotify: true, requireInteraction: true }
      : {}),
  };
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      for (const client of await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      }))
        client.postMessage({ type: "TRANSFER_NOTIFICATION" });
    })(),
  );
});
// The browser may replace a subscription; register the new one at once so
// alerts keep arriving without anyone opening the app.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const key = event.oldSubscription?.options?.applicationServerKey;
      const subscription =
        event.newSubscription ??
        (key
          ? await self.registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: key,
            })
          : null);
      if (!subscription) return;
      await fetch("/api/notifications/push", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = new URL(
        event.notification.data?.url || "/notifications",
        self.location.origin,
      );
      if (url.origin !== self.location.origin) return;
      for (const client of await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })) {
        try {
          await client.focus();
          if ("navigate" in client) await client.navigate(url.href);
          return;
        } catch {
          /* Try the next window, or open one. */
        }
      }
      return self.clients.openWindow(url.href);
    })(),
  );
});
