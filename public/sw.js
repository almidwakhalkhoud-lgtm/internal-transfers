/* No app or API responses are cached: inbox content always uses authenticated requests. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data;
      try {
        data = event.data.json();
      } catch {
        return;
      }
      const url = new URL(data.url || "/notifications", self.location.origin);
      if (url.origin !== self.location.origin) return;
      if (!data.id) {
        // Existing request alerts and the Settings test use the same registration.
        if (!/^\/(requests|transfers|settings)(\/|$)/.test(url.pathname))
          return;
        await self.registration.showNotification(data.title || "BUZZ", {
          body: data.body || "",
          icon: "/logo.jpeg",
          badge: "/logo.jpeg",
          data: { url: url.pathname + url.search },
        });
        return;
      }
      if (url.pathname !== "/notifications") return;
      // Recheck the user's inbox when online so delayed pushes do not expose an old account's data.
      try {
        const response = await fetch(
          `/api/notifications?id=${encodeURIComponent(data.id)}`,
          { cache: "no-store", credentials: "include" },
        );
        if (!response.ok)
          throw new Error("Inbox unavailable or sign-in expired");
        const inbox = await response.json();
        const item = inbox.items?.[0];
        if (!item || item.acknowledgedAt || item.closedAt) return;
        data = { ...data, title: item.title };
      } catch {
        // Offline or expired-session pushes still alert, with details behind sign-in.
        data = {
          ...data,
          title: "BUZZ · Transfer reminder / یادآوری ترانسفر",
          body: "Open your notification inbox to review incoming transfers. / برای بررسی ترانسفرهای ورودی مرکز اعلان‌ها را باز کنید.",
        };
      }
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/logo.jpeg",
        badge: "/logo.jpeg",
        tag: `transfer:${data.id}`,
        renotify: true,
        requireInteraction: true,
        lang: data.lang,
        dir: data.lang === "fa" ? "rtl" : "ltr",
        data: { url: url.pathname + url.search },
        actions: [
          {
            action: "open",
            title:
              data.lang === "fa" ? "مشاهده متن کامل" : "View full notification",
          },
        ],
      });
      for (const client of await self.clients.matchAll({ type: "window" }))
        client.postMessage({ type: "TRANSFER_NOTIFICATION" });
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
        if ("navigate" in client) {
          await client.navigate(url.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(url.href);
    })(),
  );
});
