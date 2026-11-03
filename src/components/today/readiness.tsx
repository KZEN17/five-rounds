"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { applyReadinessSwaps, ignoreReadinessSwaps, saveReadiness } from "@/actions/readiness";

type Entry = { sleepH: number | null; rhr: number | null; hrv: number | null; soreness: number | null; mood: number | null };
type Flag = { code: string; message: string };

const num = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const str = (v: number | null | undefined) => (v == null ? "" : String(v));

/** Morning check-in: sleep, resting HR, HRV, plus optional soreness and mood (1–5). */
export function ReadinessCheckIn({ entry, flags, hasData, baselineDays }: { entry?: Entry; flags: Flag[]; hasData: boolean; baselineDays: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    sleepH: str(entry?.sleepH),
    rhr: str(entry?.rhr),
    hrv: str(entry?.hrv),
    soreness: str(entry?.soreness),
    mood: str(entry?.mood),
  });
  const [error, setError] = useState("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  function save() {
    start(async () => {
      const int = (s: string) => (num(s) == null ? null : Math.round(num(s)!));
      const res = await saveReadiness({ sleepH: num(v.sleepH), rhr: int(v.rhr), hrv: num(v.hrv), soreness: int(v.soreness), mood: int(v.mood) });
      setError(res.ok ? "" : res.error);
      router.refresh();
    });
  }

  return (
    <section className="panel" aria-labelledby="ready-heading">
      <div className="flex items-baseline justify-between">
        <h3 id="ready-heading">Today&apos;s readiness</h3>
        <span className="hint">Morning numbers</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="field">
          Sleep h
          <input inputMode="decimal" placeholder="7.5" value={v.sleepH} onChange={set("sleepH")} />
        </label>
        <label className="field">
          Resting HR
          <input inputMode="numeric" placeholder="bpm" value={v.rhr} onChange={set("rhr")} />
        </label>
        <label className="field">
          HRV
          <input inputMode="decimal" placeholder="ms" value={v.hrv} onChange={set("hrv")} />
        </label>
        <label className="field">
          Soreness
          <select value={v.soreness} onChange={set("soreness")}>
            <option value="">–</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "fresh" : n === 5 ? "wrecked" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Mood
          <select value={v.mood} onChange={set("mood")}>
            <option value="">–</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "low" : n === 5 ? "great" : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary self-end" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {error ? <p role="alert" className="flag flag-warn">{error}</p> : null}
      {!hasData ? (
        <p className="hint">Sleep from your sleep tracker, resting HR and HRV from your watch&apos;s health app.</p>
      ) : flags.length ? (
        <p className="flag flag-warn">
          <strong>Ease off today.</strong> {flags.map((f) => f.message).join("; ")}.
        </p>
      ) : (
        <p className="flag flag-ok">
          Green light{baselineDays < 3 ? " (your baseline builds after 3 days of entries)" : ""}. Train as planned.
        </p>
      )}
    </section>
  );
}

/** A suggestion, never forced: one tap to apply the swaps, or ignore them for today. */
export function ReadinessBanner({ swaps }: { swaps: { from: string; to: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });
  return (
    <section className="panel border-warn" aria-labelledby="swap-heading">
      <h3 id="swap-heading">Suggested for today</h3>
      <ul className="flex flex-col gap-1">
        {swaps.map((s) => (
          <li key={s.from}>
            {s.from} → <b>{s.to}</b>
          </li>
        ))}
      </ul>
      <p className="hint">Your call. Applying swaps the sessions on today&apos;s plan; you can change them back in the day editor.</p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => applyReadinessSwaps({}))}>
          Apply
        </button>
        <button type="button" className="btn" disabled={pending} onClick={() => run(() => ignoreReadinessSwaps({}))}>
          Ignore
        </button>
      </div>
    </section>
  );
}
