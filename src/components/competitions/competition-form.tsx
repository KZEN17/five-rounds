"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCompetition, updateCompetition } from "@/actions/competitions";
import { Saving } from "@/components/spinner";

export type CompetitionValues = {
  id?: string;
  name: string;
  date: string;
  gi: "gi" | "nogi";
  weighIn: "same_day" | "day_before" | "unsure";
  limitKg: number | null;
  matchMinutes: number;
  matches: number;
  restMinutes: number;
};

const num = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Add or edit a competition. Editing the main one rebuilds the plan. */
export function CompetitionForm({ initial, isMain, onDone }: { initial: CompetitionValues; isMain?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [v, setV] = useState({
    name: initial.name,
    date: initial.date,
    gi: initial.gi,
    weighIn: initial.weighIn,
    limitKg: initial.limitKg == null ? "" : String(initial.limitKg),
    matchMinutes: String(initial.matchMinutes),
    matches: String(initial.matches),
    restMinutes: String(initial.restMinutes),
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const values = {
            name: v.name.trim(),
            date: v.date,
            gi: v.gi,
            weighIn: v.weighIn,
            limitKg: v.limitKg.trim() ? num(v.limitKg) : null,
            matchMinutes: num(v.matchMinutes) ?? 5,
            matches: Math.round(num(v.matches) ?? 4),
            restMinutes: num(v.restMinutes) ?? 20,
          };
          const res = initial.id ? await updateCompetition({ id: initial.id, ...values }) : await addCompetition(values);
          if (!res.ok) return setError(res.error);
          if (!initial.id) setV({ ...v, name: "", limitKg: "" });
          onDone?.();
          router.refresh();
        });
      }}
    >
      <label className="field">
        Name
        <input value={v.name} onChange={set("name")} placeholder="e.g. Spring Open" required />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">
          Date
          <input type="date" value={v.date} onChange={set("date")} required />
        </label>
        <label className="field">
          Division limit (kg)
          <input inputMode="decimal" value={v.limitKg} onChange={set("limitKg")} placeholder="optional" />
        </label>
        <label className="field">
          Weigh-in
          <select value={v.weighIn} onChange={set("weighIn")}>
            <option value="same_day">Right before first match</option>
            <option value="day_before">Day before</option>
            <option value="unsure">Not sure</option>
          </select>
        </label>
        <label className="field">
          Format
          <select value={v.gi} onChange={set("gi")}>
            <option value="gi">Gi</option>
            <option value="nogi">No-gi</option>
          </select>
        </label>
        <label className="field">
          Match length (min)
          <input inputMode="decimal" value={v.matchMinutes} onChange={set("matchMinutes")} />
        </label>
        <label className="field">
          Matches in a day
          <input inputMode="numeric" value={v.matches} onChange={set("matches")} />
        </label>
      </div>
      {isMain ? <p className="hint">This is your main competition: saving rebuilds your training plan for it. Logged sessions and past days stay.</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {initial.id ? (isMain ? "Save and rebuild plan" : "Save") : "Add competition"}
        </button>
        {onDone && initial.id ? (
          <button type="button" className="btn" onClick={onDone}>
            Cancel
          </button>
        ) : null}
        <Saving pending={pending} label={isMain ? "Rebuilding your plan…" : "Saving…"} />
      </div>
      {error ? (
        <p role="alert" className="flag flag-warn">
          {error}
        </p>
      ) : null}
    </form>
  );
}
