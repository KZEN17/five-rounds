/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import { Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

// App shell offline: static assets precached, pages network-first with the last copy
// as a fallback, and /offline when a page was never visited. API calls are never cached.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();

// Morning reports: show the notification, and open (or focus) the app on tap.
self.addEventListener("push", (event) => {
  const data = (() => {
    try {
      return event.data?.json() as { title?: string; body?: string; url?: string } | undefined;
    } catch {
      return { body: event.data?.text() };
    }
  })();
  event.waitUntil(
    self.registration.showNotification(data?.title ?? "Five Rounds", {
      body: data?.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data?.url ?? "/today" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data as { url?: string } | undefined)?.url ?? "/today", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => c.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((c) => c?.focus());
      return self.clients.openWindow(url);
    }),
  );
});
