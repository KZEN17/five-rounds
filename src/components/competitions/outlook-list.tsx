import type { CompOutlook, CompStatus } from "@/lib/engine";
import { shortDate } from "@/lib/time";

const STATUS: Record<CompStatus, { label: string; tone: string }> = {
  no_limit: { label: "No limit", tone: "bg-sunk text-muted" },
  on_weight: { label: "On weight", tone: "bg-good/15 text-good" },
  on_track: { label: "On track", tone: "bg-good/15 text-good" },
  needs_data: { label: "Weigh in", tone: "bg-accent-soft text-accent" },
  behind: { label: "Behind", tone: "bg-warn/20 text-warn" },
  infeasible: { label: "Can't make it safely", tone: "bg-bad/15 text-bad" },
  final_week: { label: "Final week", tone: "bg-warn/20 text-warn" },
};

export function StatusTag({ status }: { status: CompStatus }) {
  const s = STATUS[status];
  return <span className={`tag ${s.tone}`}>{s.label}</span>;
}

/** Each upcoming competition's weight status, with the one setting today's calories marked. */
export function OutlookList({ comps, drivingId }: { comps: CompOutlook[]; drivingId: string | null }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {comps.map((c) => (
        <li key={c.id} className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <StatusTag status={c.status} />
            <b>{c.name || "Competition"}</b>
            <span className="hint">
              {shortDate(c.date)} · {c.daysToWeighIn} days to weigh-in{c.limitKg != null ? ` · limit ${c.limitKg} kg` : ""}
            </span>
          </div>
          <p className="hint">
            {c.message}
            {c.id === drivingId ? <b className="text-fg"> This one sets today&apos;s calories.</b> : null}
          </p>
        </li>
      ))}
    </ul>
  );
}
