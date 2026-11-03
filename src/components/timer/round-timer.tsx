"use client";

import { useEffect, useRef, useState } from "react";
import { mmss } from "@/lib/engine";

export type TimerPreset = { key: string; label: string; kind: "rounds" | "steady"; rounds: number; workSec: number; restSec: number };
type Phase = { t: "prep" | "work" | "rest" | "done"; label: string; dur: number; r?: number };

function buildPhases(p: TimerPreset, rounds: number): Phase[] {
  const ph: Phase[] = [{ t: "prep", label: "Get ready", dur: 10 }];
  if (p.kind === "steady") ph.push({ t: "work", label: "Easy · RPE 3–4", dur: p.workSec, r: 1 });
  else
    for (let r = 1; r <= rounds; r++) {
      ph.push({ t: "work", label: `Round ${r} of ${rounds}`, dur: p.workSec, r });
      if (r < rounds) ph.push({ t: "rest", label: "Rest", dur: p.restSec, r });
    }
  ph.push({ t: "done", label: "Done", dur: 0 });
  return ph;
}

/** Work/rest rounds with 3-2-1 beeps, a screen wake lock, skip, reset and a pip per round. */
export function RoundTimer({ presets, initial }: { presets: TimerPreset[]; initial: string }) {
  const [presetKey, setPresetKey] = useState(initial);
  const preset = presets.find((p) => p.key === presetKey) ?? presets[0]!;
  const [rounds, setRounds] = useState(preset.rounds);
  const [phases, setPhases] = useState(() => buildPhases(preset, preset.rounds));
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(phases[0]!.dur);
  const [running, setRunning] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const lock = useRef<WakeLockSentinel | null>(null);
  const state = useRef({ idx, left, phases });
  useEffect(() => {
    state.current = { idx, left, phases };
  });

  function reset(p = preset, n = rounds) {
    const next = buildPhases(p, n);
    setPhases(next);
    setIdx(0);
    setLeft(next[0]!.dur);
    stop();
  }

  function beep(freq: number, ms: number) {
    const ac = audio.current;
    if (!ac) return;
    try {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ac.destination);
      g.gain.setValueAtTime(0.25, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + ms / 1000);
      o.start();
      o.stop(ac.currentTime + ms / 1000);
    } catch {
      // Audio is a nice-to-have; the timer keeps going without it.
    }
  }

  async function acquireLock() {
    try {
      if ("wakeLock" in navigator) lock.current = await navigator.wakeLock.request("screen");
    } catch {
      // Not supported or denied: the timer still works, the screen may sleep.
    }
  }

  function stop() {
    setRunning(false);
    void lock.current?.release().catch(() => {});
    lock.current = null;
  }

  async function startTimer() {
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
    } catch {
      // No audio: carry on silently.
    }
    await acquireLock();
    if (phases[idx]!.t === "done") reset();
    setRunning(true);
  }

  useEffect(() => {
    if (!running) return;
    let prev: number | null = null;
    const iv = setInterval(() => {
      const now = performance.now();
      const dt = prev == null ? 0.2 : (now - prev) / 1000; // first tick: one interval
      prev = now;
      const { idx: i, left: l, phases: ph } = state.current;
      const before = Math.ceil(l);
      let nextLeft = l - dt;
      const after = Math.ceil(nextLeft);
      if (after !== before && after <= 3 && after > 0) beep(660, 120);
      if (nextLeft <= 0) {
        const p = ph[i + 1]!;
        beep(p.t === "rest" ? 520 : 980, 500);
        setIdx(i + 1);
        if (p.t === "done") {
          stop();
          nextLeft = 0;
        } else nextLeft = p.dur;
      }
      setLeft(nextLeft);
    }, 200);
    return () => clearInterval(iv);
  }, [running]);

  // The wake lock drops when the tab is hidden; take it back when it returns.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && running) void acquireLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [running]);

  const p = phases[idx]!;
  const works = phases.filter((x) => x.t === "work");
  const nx = phases[idx + 1];
  const bg = p.t === "work" ? "bg-work/20" : p.t === "rest" ? "bg-rest/20" : "bg-sunk";

  return (
    <div className="flex flex-col gap-4">
      <div className="seg" role="group" aria-label="Timer type">
        {presets.map((x) => (
          <button
            key={x.key}
            type="button"
            aria-pressed={x.key === preset.key}
            onClick={() => {
              setPresetKey(x.key);
              setRounds(x.rounds);
              reset(x, x.rounds);
            }}
          >
            {x.label}
          </button>
        ))}
      </div>

      {preset.kind === "rounds" ? (
        <div className="flex items-center justify-center gap-3">
          <button type="button" className="btn" aria-label="One round fewer" disabled={running || rounds <= 1} onClick={() => { setRounds(rounds - 1); reset(preset, rounds - 1); }}>
            −
          </button>
          <span className="num text-xl">
            {rounds} × {mmss(preset.workSec)} / {mmss(preset.restSec)}
          </span>
          <button type="button" className="btn" aria-label="One more round" disabled={running || rounds >= 12} onClick={() => { setRounds(rounds + 1); reset(preset, rounds + 1); }}>
            +
          </button>
        </div>
      ) : null}

      <div className={`flex flex-col gap-1.5 rounded-[18px] px-4 py-6 text-center transition-colors ${bg}`} aria-live="polite">
        <div className="font-display text-[22px] font-semibold tracking-[0.08em] uppercase">{p.label}</div>
        <div className="num text-[min(30vw,132px)] leading-[0.95] font-bold" role="timer">
          {p.t === "done" ? "✓" : mmss(Math.max(0, Math.ceil(left)))}
        </div>
        {works.length > 1 ? (
          <div className="flex justify-center gap-1.5" aria-hidden>
            {works.map((x) => {
              const doneRound = p.t === "done" || (p.r ?? 0) > (x.r ?? 0) || (p.t === "rest" && p.r === x.r);
              const current = p.t === "work" && p.r === x.r;
              return <i key={x.r} className={`h-1.5 w-7 rounded-full ${doneRound ? "bg-fg" : current ? "bg-work" : "bg-line"}`} />;
            })}
          </div>
        ) : null}
        <div className="hint">
          {nx && nx.t !== "done" ? `Next: ${nx.label} · ${mmss(nx.dur)}` : p.t === "done" ? "Session complete. Log it on Today." : "Last phase"}
        </div>
      </div>

      <div className="flex justify-center gap-2">
        <button type="button" className="btn btn-primary min-w-28" onClick={() => (running ? stop() : void startTimer())}>
          {running ? "Pause" : idx > 0 && p.t !== "done" ? "Resume" : "Start"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={p.t === "done"}
          onClick={() => {
            const n = phases[idx + 1]!;
            setIdx(idx + 1);
            setLeft(n.dur);
            if (n.t === "done") stop();
          }}
        >
          Skip phase
        </button>
        <button type="button" className="btn" onClick={() => reset()}>
          Reset
        </button>
      </div>
      <p className="hint text-center">Keeps the screen awake and beeps 3-2-1 before every switch. Leave the phone at the edge of the mat with the volume up.</p>
    </div>
  );
}
