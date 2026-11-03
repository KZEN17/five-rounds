export default function Loading() {
  return (
    <main role="status" aria-busy="true" className="mx-auto flex max-w-140 flex-col gap-4 py-8">
      <span className="sr-only">Loading…</span>
      <div className="h-4 w-40 animate-pulse rounded bg-sunk" />
      <div className="h-9 w-48 animate-pulse rounded bg-sunk" />
      <div className="h-72 animate-pulse rounded-[14px] bg-sunk" />
    </main>
  );
}
