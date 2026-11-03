import type { Metadata } from "next";
import Link from "next/link";
import { DayList } from "@/components/plan/day-list";
import { PHASE_LABEL } from "@/lib/engine";
import { loadPlan } from "@/lib/plan-view";
import { requireUser } from "@/lib/session";
import { longDate } from "@/lib/time";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const { db } = await requireUser();
  const v = await loadPlan(db);
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
      <DayList days={[v.todayDay]} openDate={v.today} />
      <Link href="/plan" className="btn">
        See the whole week
      </Link>
    </>
  );
}
