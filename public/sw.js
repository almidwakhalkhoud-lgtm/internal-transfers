// Shows the push notifications the server sends for new transfers and opens
// the transfer when one is tapped. It caches nothing.
self.addEventListener("push", (event) => {
  const message = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(message.title || "BUZZ", {
      body: message.body || "",
      icon: "/logo.jpeg",
      badge: "/logo.jpeg",
      data: { url: message.url || "/" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.url, self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const open = windows.find((w) =>
          w.url.startsWith(self.location.origin),
        );
        if (open) return open.navigate(url).then((w) => w && w.focus());
        return self.clients.openWindow(url);
      }),
  );
});
