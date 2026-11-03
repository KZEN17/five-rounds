"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/** Registers the service worker (production only) and shows when changes can't be saved. */
export function Pwa({ children }: { children: React.ReactNode }) {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  return (
    <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV !== "production"} options={{ scope: "/" }}>
      {online ? null : (
        <p role="status" className="sticky top-0 z-20 -mx-4 bg-warn px-4 py-2 text-center text-sm font-semibold text-accent-ink">
          You&apos;re offline. Changes won&apos;t save until you&apos;re back online.
        </p>
      )}
      {children}
    </SerwistProvider>
  );
}
