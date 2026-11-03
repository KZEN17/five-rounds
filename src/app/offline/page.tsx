import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="mx-auto flex max-w-105 flex-col gap-4 py-10">
      <div className="eyebrow">Five Rounds</div>
      <h1>You&apos;re offline</h1>
      <p>This page hasn&apos;t been opened on this device yet, so there&apos;s no saved copy. Pages you&apos;ve opened before still work offline, and so does the timer.</p>
      <p className="hint">Logging needs a connection. Note your numbers and add them when you&apos;re back online.</p>
    </main>
  );
}
