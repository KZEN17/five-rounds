"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveWeight } from "@/actions/fuel";
import { TrendChart } from "@/components/charts/trend-chart";
import { Saving } from "@/components/spinner";
import { shortDate } from "@/lib/time";

export function WeightPanel({
  date,
  isToday,
  kg,
  onDate,
  series,
  actualRate,
  targetRate,
}: {
  date: string;
  isToday: boolean;
  kg: number;
  onDate: number | null;
  series: { date: string; kg: number; avg: number }[];
  actualRate: number | null;
  targetRate: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(onDate == null ? "" : String(onDate));
  const [error, setError] = useState("");
  const sign = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;

  return (
    <section className="panel" aria-labelledby="weight-heading">
      <h3 id="weight-heading">Bodyweight</h3>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const n = parseFloat(value.replace(",", "."));
            const res = await saveWeight({ date, kg: value.trim() && Number.isFinite(n) ? n : null });
            setError(res.ok ? "" : res.error);
            router.refresh();
          });
        }}
      >
        <label className="field flex-1">
          Weight {isToday ? "today" : `on ${shortDate(date)}`} (kg)
          <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={String(kg)} />
        </label>
        <button className="btn btn-primary" disabled={pending}>
          Save
        </button>
      </form>
      <Saving pending={pending} />
      {error ? <p role="alert" className="flag flag-warn">{error}</p> : null}
      <p className="hint">
        Weigh in the morning after the toilet, before food.{" "}
        {actualRate != null ? (
          <>
            Actual change: <b className="text-fg">{sign(actualRate)} kg/week</b> against a planned {sign(targetRate)}.
          </>
        ) : (
          "After 10 days of weigh-ins you'll see your real rate."
        )}
      </p>
      <TrendChart
        time
        data={series.map((s) => ({ x: shortDate(s.date), t: Date.parse(`${s.date}T00:00:00Z`), avg: s.avg, kg: s.kg }))}
        series={[
          { key: "avg", name: "7-day average", tone: "accent", style: "line" },
          { key: "kg", name: "Weigh-ins", tone: "ink", style: "dots" },
        ]}
        unit="kg"
        label="Bodyweight: 7-day average and daily weigh-ins"
        empty="Log two weigh-ins to see the trend."
      />
    </section>
  );
}
