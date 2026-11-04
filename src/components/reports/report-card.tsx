import Link from "next/link";
import type { Report, ReportTone } from "@/lib/engine";
import { shortDate } from "@/lib/time";

const TONE: Record<ReportTone, { bar: string; label: string }> = {
  great: { bar: "bg-good", label: "Great" },
  good: { bar: "bg-accent", label: "Good" },
  mixed: { bar: "bg-warn", label: "Mixed" },
  off: { bar: "bg-bad", label: "Slipped" },
  rest: { bar: "bg-muted", label: "Rest" },
};

/** A daily or weekly report: what went well (✓), what slipped (•), and the next step. */
export function ReportCard({ report, compact, showLink }: { report: Report; compact?: boolean; showLink?: boolean }) {
  const t = TONE[report.tone];
  const period =
    report.kind === "daily" ? shortDate(report.periodStart) : `${shortDate(report.periodStart)} – ${shortDate(report.periodEnd)}`;
  return (
    <section className="panel relative overflow-hidden pl-5" aria-label={`${report.kind === "daily" ? "Daily" : "Weekly"} report, ${period}`}>
      <i className={`absolute inset-y-0 left-0 w-1.5 ${t.bar}`} aria-hidden />
      <div className="flex items-baseline justify-between gap-2">
        <div className="eyebrow">
          {report.kind === "daily" ? "Yesterday" : "Last week"} · {period}
        </div>
        <span className="hint">{t.label}</span>
      </div>
      <h3>{report.headline}</h3>
      {report.highlights.length ? (
        <ul className="flex flex-col gap-1">
          {report.highlights.slice(0, compact ? 3 : undefined).map((h) => (
            <li key={h} className="flex gap-2 text-sm">
              <span className="text-good" aria-hidden>
                ✓
              </span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {report.concerns.length ? (
        <ul className="flex flex-col gap-1">
          {report.concerns.slice(0, compact ? 3 : undefined).map((c) => (
            <li key={c} className="flex gap-2 text-sm">
              <span className="text-warn" aria-hidden>
                •
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="font-semibold">{report.nextStep}</p>
      {showLink ? (
        <Link href="/reports" className="hint underline">
          All reports
        </Link>
      ) : null}
    </section>
  );
}
