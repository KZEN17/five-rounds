"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addSession, removeSession, resetDay, setDayDone, setSessionParams, setTimeOfDay, swapSession } from "@/actions/plan";
import type { ActionResult } from "@/lib/actions";
import { WEEKDAYS, type SessionType } from "@/lib/engine";
import { logSummary, SESSION_META, SWAP_TYPES, tagFor, TIMES, TONE_CLASS } from "@/lib/session-meta";
import { shortDate } from "@/lib/time";
import type { DayView, SessionView } from "@/lib/views";
import { LogForm } from "./log-form";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn: () => Promise<ActionResult<unknown>>) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  return { pending, error, run };
}

export function SessionLine({ s }: { s: SessionView }) {
  const meta = SESSION_META[s.type];
  return (
    <>
      <strong className="block font-semibold">
        <span className={`tag ${TONE_CLASS[meta.tone]}`}>{tagFor(s.type, s.modality)}</span>
        {s.timeOfDay ? <em className="mr-1 text-xs font-semibold tracking-[0.05em] text-accent uppercase not-italic">{s.timeOfDay}</em> : null}
        {s.title}
        {s.log?.done ? <span className="text-good"> ✓</span> : null}
      </strong>
      <span className="mb-1 block text-[13px] text-muted last:mb-0">{logSummary(s.type, s.rounds, s.log) || s.purpose}</span>
    </>
  );
}

export function DayList({ days, openDate }: { days: DayView[]; openDate?: string }) {
  const [open, setOpen] = useState<string | null>(openDate ?? null);
  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
      {days.map((d) => (
        <Day key={d.date} day={d} open={open === d.date} onToggle={() => setOpen(open === d.date ? null : d.date)} />
      ))}
    </div>
  );
}

function Day({ day, open, onToggle }: { day: DayView; open: boolean; onToggle: () => void }) {
  const { pending, error, run } = useAction();
  const done = day.sessions.filter((s) => s.log?.done).length;
  const total = day.sessions.length;
  const all = total > 0 && done === total;
  return (
    <div className={`border-t border-line first:border-t-0 ${day.isToday ? "bg-accent-soft/50" : ""}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pr-2">
        <button type="button" onClick={onToggle} aria-expanded={open} className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 py-3 pl-3.5 text-left">
          <span className="font-display leading-none uppercase">
            <b className="block text-xl">{WEEKDAYS[day.weekday]}</b>
            <span className="font-body text-xs text-muted">{shortDate(day.date)}</span>
            {day.edited ? <span className="mt-1 block font-body text-[9px] font-semibold tracking-[0.08em] text-accent">EDITED</span> : null}
          </span>
          <span className="min-w-0">
            {total ? (
              day.sessions.map((s) => <SessionLine key={s.id} s={s} />)
            ) : (
              <>
                <strong className="block font-semibold">
                  <span className={`tag ${TONE_CLASS.neutral}`}>Rest</span>
                  {day.beforeStart ? "Before your plan started" : "Rest day"}
                </strong>
                <span className="block text-[13px] text-muted">Nothing planned</span>
              </>
            )}
          </span>
        </button>
        {total ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={all ? "true" : done ? "mixed" : "false"}
            aria-label={`${done} of ${total} done. ${all ? "Clear" : "Mark all done"}`}
            disabled={pending}
            onClick={() => run(() => setDayDone({ date: day.date, done: !all }))}
            className="grid size-11 place-items-center"
          >
            <span
              className={`grid size-[26px] place-items-center rounded-full border-2 text-sm ${
                all ? "border-good bg-good text-accent-ink" : done ? "border-good text-[10px] font-bold text-good" : "border-line text-transparent"
              }`}
            >
              {done && !all ? `${done}/${total}` : "✓"}
            </span>
          </button>
        ) : null}
      </div>
      {error ? <p role="alert" className="flag flag-warn mx-3.5 mb-2">{error}</p> : null}
      {open ? <DayEditor day={day} /> : null}
    </div>
  );
}

function DayEditor({ day }: { day: DayView }) {
  const { pending, error, run } = useAction();
  const [type, setType] = useState<SessionType>("bjj");
  const [time, setTime] = useState<string>("evening");
  return (
    <div className="flex flex-col gap-3 px-3.5 pb-3.5">
      {day.sessions.map((s) => (
        <SessionEditor key={s.id} s={s} />
      ))}
      <div className="flex flex-col gap-2 rounded-[10px] bg-sunk p-3">
        <strong className="font-semibold">Add a session</strong>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Session type" className="min-w-0 flex-1" value={type} onChange={(e) => setType(e.target.value as SessionType)}>
            {SWAP_TYPES.map((t) => (
              <option key={t} value={t}>
                {SESSION_META[t].name}
              </option>
            ))}
          </select>
          <select aria-label="When" className="min-w-0 flex-1" value={time} onChange={(e) => setTime(e.target.value)}>
            {TIMES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() => run(() => addSession({ date: day.date, type, timeOfDay: (time || null) as "morning" | null }))}
          >
            Add
          </button>
        </div>
        {day.edited ? (
          <button type="button" className="btn btn-small self-start" disabled={pending} onClick={() => run(() => resetDay({ date: day.date }))}>
            Reset day to the plan
          </button>
        ) : null}
        {error ? <p role="alert" className="flag flag-warn">{error}</p> : null}
      </div>
    </div>
  );
}

function SessionEditor({ s }: { s: SessionView }) {
  const { pending, error, run } = useAction();
  const meta = SESSION_META[s.type];
  const rounded = s.type === "comp_sim" || s.type === "intervals";
  const timed = s.type === "aerobic" || s.type === "custom" || s.type === "strength";
  return (
    <div className="flex flex-col gap-2.5 border-t border-dashed border-line pt-3 first:border-t-0 first:pt-0">
      <strong className="font-semibold">
        <span className={`tag ${TONE_CLASS[meta.tone]}`}>{tagFor(s.type, s.modality)}</span>
        {s.title}
      </strong>
      {s.notes ? <p className="hint">{s.notes}</p> : null}
      {s.exercises?.length && !s.log ? (
        <ul className="hint list-disc pl-5">
          {s.exercises.map((x) => (
            <li key={x.name}>
              {x.name}: {x.prescription}
              {x.notes ? ` (${x.notes})` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <label className="field">
          Session
          <select value={s.type} disabled={pending} onChange={(e) => run(() => swapSession({ sessionId: s.id, type: e.target.value as SessionType }))}>
            {SWAP_TYPES.map((t) => (
              <option key={t} value={t}>
                {SESSION_META[t].name}
              </option>
            ))}
            {SWAP_TYPES.includes(s.type) ? null : <option value={s.type}>{meta.name}</option>}
          </select>
        </label>
        <label className="field">
          When
          <select
            value={s.timeOfDay ?? ""}
            disabled={pending}
            onChange={(e) => run(() => setTimeOfDay({ sessionId: s.id, timeOfDay: (e.target.value || null) as "morning" | null }))}
          >
            {TIMES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {timed ? (
          <NumberParam label="Planned minutes" value={s.minutes} onCommit={(minutes) => run(() => setSessionParams({ sessionId: s.id, minutes }))} />
        ) : null}
        {rounded ? <NumberParam label="Planned rounds" value={s.rounds} onCommit={(rounds) => run(() => setSessionParams({ sessionId: s.id, rounds }))} /> : null}
        {s.type === "custom" ? (
          <label className="field col-span-2">
            Name
            <input
              defaultValue={s.title}
              placeholder="e.g. Wrestling class"
              onBlur={(e) => {
                const title = e.target.value.trim();
                if (title && title !== s.title) run(() => setSessionParams({ sessionId: s.id, title }));
              }}
            />
          </label>
        ) : null}
      </div>
      <LogForm session={s} />
      <button type="button" className="btn btn-small self-start" disabled={pending} onClick={() => run(() => removeSession({ sessionId: s.id }))}>
        Remove this session
      </button>
      {error ? <p role="alert" className="flag flag-warn">{error}</p> : null}
    </div>
  );
}

function NumberParam({ label, value, onCommit }: { label: string; value: number | undefined; onCommit: (v: number) => void }) {
  return (
    <label className="field">
      {label}
      <input
        inputMode="numeric"
        defaultValue={value ?? ""}
        onBlur={(e) => {
          const v = Math.round(Number(e.target.value));
          if (Number.isFinite(v) && v > 0 && v !== value) onCommit(v);
        }}
      />
    </label>
  );
}
