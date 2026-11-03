"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type Series = { key: string; name: string; tone: "accent" | "ink"; style: "line" | "dashed" | "dots" };
export type Point = { x: string } & Record<string, number | string | null>;

const COLOR = { accent: "var(--accent)", ink: "var(--fg)" } as const;

/**
 * One-axis trend chart in the app's colours: the measure in purple, any reference (plan,
 * raw readings) in dashed or dotted ink. Hover tooltip, legend only for 2+ series, and a
 * table view underneath for screen readers and exact values.
 */
export function TrendChart({
  data,
  series,
  unit,
  label,
  empty,
  height = 180,
}: {
  data: Point[];
  series: Series[];
  unit: string;
  label: string;
  empty: string;
  height?: number;
}) {
  const main = series[0]!;
  if (data.filter((d) => typeof d[main.key] === "number").length < 2) return <p className="hint">{empty}</p>;
  return (
    <figure className="m-0 flex flex-col gap-1">
      <div style={{ height }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 3" />
            <XAxis
              dataKey="x"
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--line)" }}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis domain={["auto", "auto"]} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--fg)", fontSize: 13 }}
              labelStyle={{ color: "var(--muted)" }}
              formatter={(value, name) => [`${value} ${unit}`, name]}
            />
            {series.length > 1 ? <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} /> : null}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.style === "dots" ? "none" : COLOR[s.tone]}
                strokeWidth={s.style === "dashed" ? 1.5 : 2}
                strokeDasharray={s.style === "dashed" ? "5 4" : undefined}
                dot={s.style === "dashed" ? false : { r: 4, fill: COLOR[s.tone], stroke: "var(--surface)", strokeWidth: 2 }}
                activeDot={s.style === "dashed" ? false : { r: 6, stroke: "var(--surface)", strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
                legendType={s.style === "dots" ? "circle" : "plainline"}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details>
        <summary className="hint cursor-pointer">Show as table</summary>
        <div className="max-h-60 overflow-auto">
          <table className="rounds-table">
            <thead>
              <tr>
                <th>When</th>
                {series.map((s) => (
                  <th key={s.key}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={`${d.x}-${i}`}>
                  <td>{d.x}</td>
                  {series.map((s) => (
                    <td key={s.key} className="num">
                      {typeof d[s.key] === "number" ? `${d[s.key]} ${unit}` : "–"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
