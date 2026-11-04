import type { Metadata } from "next";
import Link from "next/link";
import { DayList } from "@/components/plan/day-list";
import { ReportCard } from "@/components/reports/report-card";
import { ReadinessBanner, ReadinessCheckIn } from "@/components/today/readiness";
import { ensureDailyReport, ensureWeeklyReport } from "@/lib/db/report-store";
import { readinessFor } from "@/lib/db/readiness-store";
import { addDays, mondayOf, PHASE_LABEL, weekdayOf } from "@/lib/engine";
import { loadPlan } from "@/lib/plan-view";
import { requireUser } from "@/lib/session";
import { longDate } from "@/lib/time";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const { db } = await requireUser();
  const v = await loadPlan(db);
  const [r, yesterday, lastWeek] = await Promise.all([
    readinessFor(db, v.today, v.input),
    ensureDailyReport(db, addDays(v.today, -1), v.input),
    weekdayOf(v.today) <= 1 ? ensureWeeklyReport(db, addDays(mondayOf(v.today), -7), v.input) : null,
  ]);
  const w = v.out.weeks[v.currentWeek - 1]!;
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="eyebrow">{longDate(v.today)}</div>
          <h2>Today</h2>
        </div>
        <div className="hint text-right">
          Week {v.currentWeek} · {PHASE_LABEL[w.phase]}
          <br />
          <b className="num text-lg text-fg">{Math.max(0, v.daysToComp)}</b> days to go
        </div>
      </div>
      {lastWeek ? <ReportCard report={lastWeek.payload} compact /> : null}
      {yesterday ? <ReportCard report={yesterday.payload} compact showLink /> : null}
      <ReadinessCheckIn
        entry={r.entry}
        flags={r.readiness.flags}
        hasData={r.readiness.hasData}
        baselineDays={r.readiness.baseline.entries}
      />
      {r.suggestions.length ? <ReadinessBanner swaps={r.suggestions.map((s) => ({ from: s.from.title, to: s.to.title }))} /> : null}
      <DayList days={[v.todayDay]} openDate={v.today} />
      <Link href="/plan" className="btn">
        See the whole week
      </Link>
    </>
  );
}
