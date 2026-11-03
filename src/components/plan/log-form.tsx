"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveLog } from "@/actions/plan";
import type { ExerciseLog, RoundLog } from "@/lib/db/schema";
import { mmss } from "@/lib/engine";
import { roundStats, SESSION_META } from "@/lib/session-meta";
import type { SessionView } from "@/lib/views";

const GAS = ["Attacking", "Holding on", "Survival"] as const;
const toNum = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const toInt = (v: string) => {
  const n = toNum(v);
  return n == null ? null : Math.round(n);
};
const str = (v: number | null | undefined) => (v == null ? "" : String(v));

function Field({ label, value, onChange, placeholder, decimal }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; decimal?: boolean }) {
  return (
    <label className="field">
      {label}
      <input inputMode={decimal ? "decimal" : "numeric"} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Logging, by session type: mat sessions without HR, machines with HR and per-round numbers, strength with exercises. */
export function LogForm({ session }: { session: SessionView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const log = session.log;
  const kind = SESSION_META[session.type].log;
  const n = session.rounds ?? 0;
  const rounded = session.type === "comp_sim" || session.type === "intervals";

  const [done, setDone] = useState(log?.done ?? false);
  const [minutes, setMinutes] = useState(str(log?.minutes));
  const [avgHr, setAvgHr] = useState(str(log?.avgHr));
  const [maxHr, setMaxHr] = useState(str(log?.maxHr));
  const [rpe, setRpe] = useState(str(log?.rpe));
  const [hardRounds, setHardRounds] = useState(str(log?.hardRounds));
  const [unit, setUnit] = useState<"m" | "cal">(log?.outputUnit ?? "m");
  const [rounds, setRounds] = useState<RoundLog[]>(() => Array.from({ length: n }, (_, i) => log?.rounds?.[i] ?? {}));
  const [exercises, setExercises] = useState<ExerciseLog[]>(
    () => log?.exercises ?? (session.exercises ?? []).map((x) => ({ name: x.name, done: false })),
  );
  const [notes, setNotes] = useState(log?.notes ?? "");

  const setRound = (i: number, patch: Partial<RoundLog>) => setRounds((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const stats = roundStats(rounds, n);

  function save(nextDone = done) {
    setMsg("");
    start(async () => {
      const res = await saveLog({
        sessionId: session.id,
        done: nextDone,
        minutes: toInt(minutes),
        avgHr: kind === "machine" ? toInt(avgHr) : null,
        maxHr: kind === "machine" ? toInt(maxHr) : null,
        rpe: toNum(rpe),
        hardRounds: kind === "mat" && session.type !== "comp_sim" ? toInt(hardRounds) : null,
        outputUnit: session.type === "intervals" ? unit : null,
        rounds: rounded && n > 0 ? rounds.map((r) => ({ rpe: r.rpe ?? null, gas: r.gas ?? null, endHr: r.endHr ?? null, recHr: r.recHr ?? null, output: r.output ?? null })) : null,
        exercises: kind === "strength" && exercises.length ? exercises : null,
        notes: notes.trim() || null,
      });
      setMsg(res.ok ? "Saved." : res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="toggle">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => {
            setDone(e.target.checked);
            save(e.target.checked);
          }}
        />
        Session done
      </label>

      {session.type === "comp_sim" && n > 0 ? (
        <p className="hint">
          {n} × {mmss(session.workSec ?? 300)} rounds, {mmss(session.restSec ?? 60)} rest. Rate each round&apos;s effort straight after the buzzer (1–10). The goal is a flat line: round {n} shouldn&apos;t feel much harder than round 1.
        </p>
      ) : session.type === "intervals" && n > 0 ? (
        <p className="hint">
          {n} × {mmss(session.workSec ?? 300)} work, {mmss(session.restSec ?? 60)} rest. Note your HR at the end of each round, then again at the end of the rest.
        </p>
      ) : session.type === "aerobic" ? (
        <p className="hint">Target {session.minutes ?? "?"} min at RPE 3–4. Stay under your Zone 2 ceiling (set it in Settings → Devices).</p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Minutes" value={minutes} onChange={setMinutes} placeholder={str(session.minutes)} />
        {kind === "machine" ? (
          <>
            <Field label="Avg HR" value={avgHr} onChange={setAvgHr} placeholder="bpm" />
            <Field label="Max HR" value={maxHr} onChange={setMaxHr} placeholder="bpm" />
          </>
        ) : null}
        {kind !== "simple" ? <Field label={kind === "mat" ? "Session RPE" : "RPE"} value={rpe} onChange={setRpe} placeholder="1–10" decimal /> : null}
        {kind === "mat" && session.type !== "comp_sim" ? <Field label="Hard rounds" value={hardRounds} onChange={setHardRounds} placeholder="e.g. 6" /> : null}
      </div>

      {rounded && n > 0 ? (
        <div className="overflow-x-auto">
          <table className="rounds-table">
            <thead>
              <tr>
                <th>Rd</th>
                {session.type === "comp_sim" ? (
                  <>
                    <th>Effort RPE</th>
                    <th>Gas in last minute</th>
                  </>
                ) : (
                  <>
                    <th>HR end</th>
                    <th>HR after rest</th>
                    <th>
                      <select aria-label="Output unit" value={unit} onChange={(e) => setUnit(e.target.value as "m" | "cal")} className="min-h-8 py-0.5 text-xs">
                        <option value="m">Metres</option>
                        <option value="cal">Calories</option>
                      </select>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rounds.map((r, i) => (
                <tr key={i}>
                  <td className="num">{i + 1}</td>
                  {session.type === "comp_sim" ? (
                    <>
                      <td>
                        <input aria-label={`Round ${i + 1} RPE`} inputMode="decimal" placeholder="1–10" value={str(r.rpe)} onChange={(e) => setRound(i, { rpe: toNum(e.target.value) })} />
                      </td>
                      <td>
                        <select aria-label={`Round ${i + 1} gas`} value={r.gas ?? ""} onChange={(e) => setRound(i, { gas: (e.target.value || null) as RoundLog["gas"] })}>
                          <option value="">–</option>
                          {GAS.map((g) => (
                            <option key={g}>{g}</option>
                          ))}
                        </select>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <input aria-label={`Round ${i + 1} end HR`} inputMode="numeric" placeholder="bpm" value={str(r.endHr)} onChange={(e) => setRound(i, { endHr: toInt(e.target.value) })} />
                      </td>
                      <td>
                        <input aria-label={`Round ${i + 1} HR after rest`} inputMode="numeric" placeholder="bpm" value={str(r.recHr)} onChange={(e) => setRound(i, { recHr: toInt(e.target.value) })} />
                      </td>
                      <td>
                        <input aria-label={`Round ${i + 1} output`} inputMode="numeric" placeholder={unit} value={str(r.output)} onChange={(e) => setRound(i, { output: toNum(e.target.value) })} />
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint mt-1">
            {session.type === "comp_sim" ? (
              <>
                Round 1 → last <b>{stats.firstRpe != null && stats.lastRpe != null ? `${stats.firstRpe} → ${stats.lastRpe}` : "–"}</b> · Still attacking <b>{stats.attacking}/{n}</b> rounds
              </>
            ) : (
              <>
                HR drop per rest <b>{stats.recovery != null ? `${Math.round(stats.recovery)} bpm` : "–"}</b> · Round 1 → last <b>{stats.fade != null ? `${stats.fade > 0 ? "−" : "+"}${Math.abs(stats.fade).toFixed(1)}%` : "–"}</b>
              </>
            )}
          </p>
        </div>
      ) : null}

      {kind === "strength" && exercises.length ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="field mb-1">Exercises done</legend>
          {exercises.map((x, i) => {
            const plan = session.exercises?.find((e) => e.name === x.name);
            return (
              <div key={x.name} className="grid grid-cols-[auto_minmax(0,1fr)_7rem] items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={x.name}
                  className="size-5 min-h-0"
                  checked={x.done}
                  onChange={(e) => setExercises((xs) => xs.map((y, j) => (j === i ? { ...y, done: e.target.checked } : y)))}
                />
                <span className="text-sm">
                  {x.name} <span className="hint">{plan?.prescription}</span>
                </span>
                <input
                  aria-label={`${x.name} detail`}
                  placeholder="e.g. 3×5 40kg"
                  className="min-h-9 py-1 text-sm"
                  value={x.detail ?? ""}
                  onChange={(e) => setExercises((xs) => xs.map((y, j) => (j === i ? { ...y, detail: e.target.value } : y)))}
                />
              </div>
            );
          })}
        </fieldset>
      ) : null}

      <label className="field">
        Notes
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel? Partners, gas, technique." />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => save()}>
          {pending ? "Saving…" : "Save log"}
        </button>
        {rounded || session.type === "aerobic" ? (
          <Link href={`/timer?session=${session.id}`} className="btn">
            Open timer
          </Link>
        ) : null}
        <span className="hint" role="status">
          {msg}
        </span>
      </div>
    </div>
  );
}
