import { asc, lte } from "drizzle-orm";
import { addDays, daysBetween, mondayOf, WEEKDAYS, weekdayOf, type IsoDate, type Plan } from "@/lib/engine";
import { logSummary, roundStats } from "@/lib/session-meta";
import { shortDate } from "@/lib/time";
import { sessionsBetween } from "./plan-store";
import { weights } from "./schema";
import type { ScopedDb } from "./scoped";

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Trends from the logs: the legacy Progress tab, generalised. */
export async function progressData(db: ScopedDb, plan: Plan | undefined, today: IsoDate) {
  const [rows, weightRows] = await Promise.all([
    sessionsBetween(db, "2000-01-01", today),
    db.select(weights, lte(weights.date, today)).orderBy(asc(weights.date)),
  ]);
  const logged = rows.filter((r) => !r.session.deletedAt && r.log);
  const label = (date: IsoDate) => `${WEEKDAYS[weekdayOf(date)]} ${shortDate(date)}`;

  const aerobicHr = logged
    .filter((r) => r.session.type === "aerobic" && r.log?.avgHr)
    .map((r) => ({ x: label(r.session.date), hr: r.log!.avgHr }));

  const hard = logged
    .filter((r) => (r.session.type === "comp_sim" || r.session.type === "intervals") && r.session.params.variant !== "threshold")
    .map((r) => ({ r, st: roundStats(r.log!.rounds, r.session.params.rounds ?? 0) }));
  const simFinal = hard
    .filter((h) => h.r.session.type === "comp_sim" && h.st.lastRpe != null)
    .map((h) => ({ x: `${shortDate(h.r.session.date)} · ${h.r.session.params.rounds}r`, rpe: h.st.lastRpe }));
  const recovery = hard
    .filter((h) => h.r.session.type === "intervals" && h.st.recovery != null)
    .map((h) => ({ x: label(h.r.session.date), drop: Math.round(h.st.recovery!) }));
  const rowing = hard
    .filter((h) => h.r.session.type === "intervals" && h.r.session.params.modality === "rower")
    .map((h) => ({
      date: h.r.session.date,
      rounds: h.r.session.params.rounds ?? 0,
      avgOutput: h.st.avgOutput == null ? null : Math.round(h.st.avgOutput),
      unit: h.r.log!.outputUnit ?? "m",
      fade: h.st.fade == null ? null : round1(h.st.fade),
      recovery: h.st.recovery == null ? null : Math.round(h.st.recovery),
    }));

  // Weekly completion, Monday to Sunday.
  const live = rows.filter((r) => !r.session.deletedAt);
  const weeks = new Map<IsoDate, { done: number; total: number }>();
  for (const r of live) {
    const w = mondayOf(r.session.date);
    const cur = weeks.get(w) ?? { done: 0, total: 0 };
    cur.total++;
    if (r.log?.done) cur.done++;
    weeks.set(w, cur);
  }
  const completion = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([start, c]) => ({ start, ...c }));

  // Weight against the plan's line.
  const n = plan?.nutrition;
  const planned = (date: IsoDate) => {
    if (!plan || !n) return null;
    const end = n.finalWeekStart;
    const d = Math.min(Math.max(0, daysBetween(plan.start, date)), Math.max(0, daysBetween(plan.start, end)));
    return round1(n.startWeightKg + (n.weeklyRateKg * d) / 7);
  };
  const weight = weightRows.map((w) => {
    const window = weightRows.filter((x) => {
      const ago = daysBetween(x.date, w.date);
      return ago >= 0 && ago < 7;
    });
    return { x: shortDate(w.date), t: Date.parse(`${w.date}T00:00:00Z`), avg: round1(window.reduce((s, x) => s + x.kg, 0) / window.length), plan: planned(w.date) };
  });

  // Plain-text summary for a coach or notes.
  const lines: string[] = [];
  const doneWeeks = completion.filter((c) => c.total > 0);
  lines.push(`Five Rounds: progress to ${today}${plan ? ` (competition ${plan.compDate})` : ""}`);
  for (const c of doneWeeks) {
    const inWeek = live.filter((r) => r.session.date >= c.start && r.session.date <= addDays(c.start, 6) && r.log?.done);
    if (!inWeek.length) continue;
    lines.push("", `Week of ${shortDate(c.start)}: ${c.done}/${c.total} sessions`);
    for (const r of inWeek) {
      const s = r.session;
      const summary = logSummary(s.type, s.params.rounds, r.log) || "done";
      lines.push(`  ${WEEKDAYS[weekdayOf(s.date)]}${s.timeOfDay ? ` ${s.timeOfDay}` : ""} ${s.title}: ${summary}${r.log?.notes ? ` — ${r.log.notes}` : ""}`);
    }
  }

  return { aerobicHr, simFinal, recovery, rowing, completion, weight, text: lines.join("\n") };
}
