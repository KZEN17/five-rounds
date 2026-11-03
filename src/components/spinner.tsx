"use client";

import { useLinkStatus } from "next/link";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px] ${className}`}
    />
  );
}

/** A fixed-size spinner inside a <Link> that shows while its navigation is pending. */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden className={`pointer-events-none transition-opacity ${pending ? "opacity-100" : "opacity-0"} ${className}`}>
      <Spinner />
    </span>
  );
}

/** "Saving…" with a spinner, announced to screen readers. Renders nothing when idle. */
export function Saving({ pending, label = "Saving…" }: { pending: boolean; label?: string }) {
  if (!pending) return null;
  return (
    <span role="status" className="hint inline-flex items-center gap-1.5">
      <Spinner /> {label}
    </span>
  );
}
