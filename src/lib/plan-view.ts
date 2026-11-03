import { and, gte, lte } from "drizzle-orm";
import { redirect } from "next/navigation";
import { userTimezone } from "@/lib/actions";
import { activePlan, latestInput, sessionsBetween } from "@/lib/db/plan-store";
import { weekMarks } from "@/lib/db/schema";
import type { ScopedDb } from "@/lib/db/scoped";
import { addDays, daysBetween } from "@/lib/engine";
import { todayIn } from "@/lib/time";
import { buildDays } from "@/lib/views";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Everything the Plan and Today screens need, from one sessions query. */
export async function loadPlan(db: ScopedDb, requestedWeek?: number) {
  const [plan, input, tz] = await Promise.all([activePlan(db), latestInput(db), userTimezone(db)]);
  if (!plan || !input) redirect("/onboarding");
  const out = plan.output;
  const today = todayIn(tz);
  const weeks = out.weeks.length;
  const end = addDays(out.start, weeks * 7 - 1);
  const [rows, marks] = await Promise.all([
    sessionsBetween(db, out.start < today ? out.start : today, end > today ? end : today),
    db.select(weekMarks, and(gte(weekMarks.weekStart, out.start), lte(weekMarks.weekStart, end))),
  ]);
  const currentWeek = clamp(Math.floor(daysBetween(out.start, today) / 7) + 1, 1, weeks);
  const week = clamp(requestedWeek || currentWeek, 1, weeks);
  const weekStats = out.weeks.map((w) => {
    const live = rows.filter((r) => !r.session.deletedAt && r.session.date >= w.start && r.session.date <= addDays(w.start, 6));
    return {
      index: w.index,
      start: w.start,
      phase: w.phase,
      total: live.length,
      done: live.filter((r) => r.log?.done).length,
      marked: marks.some((m) => m.weekStart === w.start && m.done),
    };
  });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(out.weeks[week - 1]!.start, i));
  return {
    plan,
    input: input.data,
    out,
    today,
    week,
    currentWeek,
    weekStats,
    days: buildDays(rows, weekDates, plan.id, today, plan.output.generatedOn),
    todayDay: buildDays(rows, [today], plan.id, today, plan.output.generatedOn)[0]!,
    daysToComp: daysBetween(today, out.compDate),
  };
}
