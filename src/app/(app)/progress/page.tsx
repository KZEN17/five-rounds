import type { Metadata } from "next";
import { TrendChart } from "@/components/charts/trend-chart";
import { CopyProgress } from "@/components/progress/copy-progress";
import { userTimezone } from "@/lib/actions";
import { activePlan } from "@/lib/db/plan-store";
import { progressData } from "@/lib/db/progress-store";
import { requireUser } from "@/lib/session";
import { shortDate, todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  const { db } = await requireUser();
  const [plan, tz] = await Promise.all([activePlan(db), userTimezone(db)]);
  const p = await progressData(db, plan?.output, todayIn(tz));
  const weeksDone = p.completion.filter((c) => c.total && c.done === c.total).length;

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h2>Progress</h2>
        <span className="num text-[22px] text-muted">
          {weeksDone}/{p.completion.length} full weeks
        </span>
      </div>

      <section className="panel">
        <h3>Easy aerobic: average heart rate</h3>
        <p className="hint">Same easy effort, lower heart rate over the weeks: your aerobic engine is growing.</p>
        <TrendChart
          data={p.aerobicHr}
          series={[{ key: "hr", name: "Avg HR", tone: "accent", style: "line" }]}
          unit="bpm"
          label="Average heart rate in easy aerobic sessions"
          empty="Log heart rate on two easy sessions to see the line."
        />
      </section>

      <section className="panel">
        <h3>Comp sim: effort in the final round</h3>
        <p className="hint">RPE of your last round. Holding it steady or lower while the rounds go up means you can still attack late.</p>
        <TrendChart
          data={p.simFinal}
          series={[{ key: "rpe", name: "Final-round RPE", tone: "accent", style: "line" }]}
          unit="RPE"
          label="Final-round RPE in comp sims"
          empty="Rate every round of two comp sims to see the line."
        />
      </section>

      <section className="panel">
        <h3>Intervals: recovery in the rest</h3>
        <p className="hint">How many beats your heart rate drops between the end of a round and the end of the rest. Bigger is better.</p>
        <TrendChart
          data={p.recovery}
          series={[{ key: "drop", name: "HR drop", tone: "accent", style: "line" }]}
          unit="bpm"
          label="Heart-rate drop during interval rests"
          empty="Log end-of-round and after-rest heart rate in two interval sessions."
        />
      </section>

      <section className="panel">
        <h3>Rowing pacing</h3>
        <p className="hint">Output change from round 1 to the last round. Aim to stay within 5%.</p>
        {p.rowing.length ? (
          <div className="overflow-x-auto">
            <table className="rounds-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Rounds</th>
                  <th>Avg / round</th>
                  <th>R1 → last</th>
                  <th>HR drop</th>
                </tr>
              </thead>
              <tbody>
                {p.rowing.map((r) => (
                  <tr key={r.date}>
                    <td>{shortDate(r.date)}</td>
                    <td className="num">{r.rounds}</td>
                    <td className="num">{r.avgOutput != null ? `${r.avgOutput} ${r.unit}` : "–"}</td>
                    <td className={`num ${r.fade == null ? "" : r.fade > 5 ? "text-bad" : "text-good"}`}>
                      {r.fade != null ? `${r.fade > 0 ? "−" : "+"}${Math.abs(r.fade).toFixed(1)}%` : "–"}
                    </td>
                    <td className="num">{r.recovery != null ? `${r.recovery} bpm` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">No rowing sessions logged yet.</p>
        )}
      </section>

      <section className="panel">
        <h3>Weekly completion</h3>
        {p.completion.length ? (
          <ul className="flex flex-col gap-1.5">
            {p.completion.map((c) => (
              <li key={c.start} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3rem] items-center gap-2 text-sm">
                <span className="text-muted">{shortDate(c.start)}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-sunk" role="img" aria-label={`${c.done} of ${c.total} sessions`}>
                  <i className="block h-full rounded-full bg-accent" style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} />
                </span>
                <span className="num text-right">
                  {c.done}/{c.total}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No sessions yet.</p>
        )}
      </section>

      <section className="panel">
        <h3>Weight against the plan</h3>
        <TrendChart
          time
          data={p.weight}
          series={[
            { key: "avg", name: "7-day average", tone: "accent", style: "line" },
            { key: "plan", name: "Plan", tone: "ink", style: "dashed" },
          ]}
          unit="kg"
          label="Bodyweight 7-day average against the planned line"
          empty="Log two weigh-ins on the Fuel tab to see the trend."
        />
      </section>

      <CopyProgress text={p.text} />
    </>
  );
}
