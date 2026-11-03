import type { Metadata } from "next";
import Link from "next/link";
import { DayList } from "@/components/plan/day-list";
import { WeekToggle } from "@/components/plan/week-toggle";
import { LinkPending } from "@/components/spinner";
import { addDays, PHASE_LABEL } from "@/lib/engine";
import { loadPlan } from "@/lib/plan-view";
import { requireUser } from "@/lib/session";
import { shortDate } from "@/lib/time";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { db } = await requireUser();
  const v = await loadPlan(db, Number((await searchParams).week) || undefined);
  const w = v.out.weeks[v.week - 1]!;
  const stats = v.weekStats[v.week - 1]!;
  const doneWeeks = v.weekStats.filter((s) => s.marked).length;
  const compName = v.input.competition.name || (v.input.competition.kind === "test" ? "Test day" : "Competition");

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="eyebrow">
            {PHASE_LABEL[w.phase]} phase{w.deload ? " · deload week" : ""}
          </div>
          <h2>Week {v.week}</h2>
        </div>
        <div className="text-right">
          <div className="num text-[26px] leading-none font-bold">{v.daysToComp > 0 ? v.daysToComp : 0}</div>
          <div className="hint">
            days to {compName} · {shortDate(v.out.compDate)}
          </div>
        </div>
      </div>

      <nav aria-label="Plan weeks" className="flex gap-1.5 overflow-x-auto pb-1">
        {v.weekStats.map((s) => (
          <Link
            key={s.index}
            href={`/plan?week=${s.index}`}
            scroll={false}
            aria-current={s.index === v.week ? "page" : undefined}
            className={`relative flex min-h-12 min-w-11 flex-1 flex-col items-center justify-center rounded-[10px] border px-1 font-display text-xl font-semibold no-underline ${
              s.index === v.week
                ? "border-accent bg-accent text-accent-ink"
                : s.marked
                  ? "border-good bg-surface text-fg"
                  : "border-line bg-surface text-fg"
            }`}
          >
            {s.index}
            <small className={`font-body text-[9px] tracking-[0.08em] uppercase ${s.index === v.week ? "opacity-80" : s.marked ? "text-good" : "text-muted"}`}>
              {s.marked ? "Done" : s.done ? `${s.done}/${s.total}` : s.phase === "taper" ? "Taper" : `${s.total} sess`}
            </small>
            <LinkPending className="absolute top-1 right-1" />
          </Link>
        ))}
      </nav>

      <div className="panel gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3>
            {shortDate(w.start)} – {shortDate(addDays(w.start, 6))}
          </h3>
          <span className="hint">
            {doneWeeks}/{v.weekStats.length} weeks · {stats.done}/{stats.total} sessions this week
          </span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-[3px] bg-sunk" role="img" aria-label={`${doneWeeks} of ${v.weekStats.length} weeks completed`}>
          <i className="absolute inset-y-0 left-0 rounded-[3px] bg-accent" style={{ width: `${(doneWeeks / v.weekStats.length) * 100}%` }} />
          <b className="absolute inset-y-0 right-[10%] w-[14%] bg-fg opacity-85" />
        </div>
        <WeekToggle weekStart={w.start} week={v.week} done={stats.marked} />
      </div>

      <DayList days={v.days} />

      {v.out.warnings.length || v.out.nutrition.warnings.length ? (
        <details className="panel">
          <summary className="cursor-pointer font-semibold">Plan notes ({v.out.warnings.length})</summary>
          <ul className="hint mt-2 flex list-disc flex-col gap-1 pl-5">
            {v.out.warnings.map((x) => (
              <li key={x.code}>{x.message}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <Link href="/onboarding" className="btn">
        Change your answers and regenerate the plan
      </Link>
      <p className="hint">Regenerating keeps everything you&apos;ve logged and never changes past days.</p>
    </>
  );
}
