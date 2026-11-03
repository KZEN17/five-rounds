/** Placeholder for screens that later milestones fill in. */
export function ComingSoon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h2>{title}</h2>
      <div className="panel">
        <p className="hint">{children}</p>
      </div>
    </>
  );
}
