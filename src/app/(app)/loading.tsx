/** Shown instantly while a tab's server data loads; the header and tab bar stay in place. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Loading…</span>
      <div className="h-7 w-36 animate-pulse rounded bg-sunk" />
      <div className="h-24 animate-pulse rounded-[14px] bg-sunk" />
      <div className="h-40 animate-pulse rounded-[14px] bg-sunk" />
      <div className="h-24 animate-pulse rounded-[14px] bg-sunk" />
    </div>
  );
}
