import type { ExerciseLog, RoundLog } from "@/lib/db/schema";
import type { Modality, SessionType } from "@/lib/engine";

export type LogKind = "mat" | "machine" | "strength" | "simple";
export type Tone = "accent" | "good" | "work" | "neutral";

type Meta = { tag: string; name: string; tone: Tone; log: LogKind };

export const SESSION_META: Record<SessionType, Meta> = {
  bjj: { tag: "BJJ", name: "Hard BJJ", tone: "accent", log: "mat" },
  bjj_technical: { tag: "BJJ", name: "Technical BJJ", tone: "accent", log: "mat" },
  open_mat: { tag: "Open", name: "Open mat", tone: "neutral", log: "mat" },
  comp_sim: { tag: "Sim", name: "Comp sim", tone: "work", log: "mat" },
  intervals: { tag: "Rounds", name: "Intervals", tone: "work", log: "machine" },
  aerobic: { tag: "Z2", name: "Easy aerobic", tone: "good", log: "machine" },
  strength: { tag: "Gym", name: "Strength", tone: "neutral", log: "strength" },
  mobility: { tag: "Mob", name: "Mobility", tone: "good", log: "simple" },
  walk: { tag: "Recover", name: "Recovery walk", tone: "good", log: "simple" },
  competition: { tag: "Comp", name: "Competition", tone: "accent", log: "mat" },
  custom: { tag: "Other", name: "Custom", tone: "neutral", log: "machine" },
};

export const SWAP_TYPES: SessionType[] = [
  "bjj",
  "bjj_technical",
  "open_mat",
  "comp_sim",
  "intervals",
  "aerobic",
  "strength",
  "mobility",
  "walk",
  "custom",
];

export const TONE_CLASS: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent",
  good: "bg-good/15 text-good",
  work: "bg-work/15 text-work",
  neutral: "bg-sunk text-muted",
};

const MACHINE_TAG: Partial<Record<Modality, string>> = { rower: "Row", bike: "Bike", assault_bike: "Assault", run: "Run", swim: "Swim" };

export function tagFor(type: SessionType, modality: Modality): string {
  if (type === "intervals") return MACHINE_TAG[modality] ?? "Rounds";
  return SESSION_META[type].tag;
}

export const TIMES = [
  ["", "Any time"],
  ["morning", "Morning"],
  ["midday", "Midday"],
  ["evening", "Evening"],
] as const;

export type LogLike = {
  done: boolean;
  minutes: number | null;
  avgHr: number | null;
  rpe: number | null;
  hardRounds: number | null;
  rounds: RoundLog[] | null;
  exercises?: ExerciseLog[] | null;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Per-round stats, as in the legacy app: HR drop in the rest, output fade, round RPE first → last. */
export function roundStats(rounds: RoundLog[] | null | undefined, n: number) {
  const rr = (rounds ?? []).slice(0, n);
  const drops = rr.flatMap((r) => (isNum(r?.endHr) && isNum(r?.recHr) ? [r.endHr - r.recHr] : []));
  const outputs = rr.flatMap((r) => (isNum(r?.output) ? [r.output] : []));
  const fade = outputs.length >= 2 ? ((outputs[0]! - outputs[outputs.length - 1]!) / outputs[0]!) * 100 : null;
  const rpes = rr.map((r) => (isNum(r?.rpe) ? r.rpe : null));
  const first = rpes[0] ?? null;
  const last = rpes.length === n && n > 0 ? (rpes[n - 1] ?? null) : null;
  const attacking = rr.filter((r) => r?.gas === "Attacking").length;
  return { recovery: mean(drops), fade, avgOutput: mean(outputs), firstRpe: first, lastRpe: last, attacking };
}

/** One-line summary of a log, e.g. "60 min · RPE 8 · 6 hard rounds". */
export function logSummary(type: SessionType, rounds: number | undefined, log: LogLike | null | undefined): string {
  if (!log) return "";
  const bits: string[] = [];
  if (log.minutes) bits.push(`${log.minutes} min`);
  if (log.avgHr && SESSION_META[type].log === "machine") bits.push(`avg ${log.avgHr} bpm`);
  if (log.rpe) bits.push(`RPE ${log.rpe}`);
  if (log.hardRounds) bits.push(`${log.hardRounds} hard rounds`);
  const n = rounds ?? 0;
  if (type === "comp_sim" && n) {
    const st = roundStats(log.rounds, n);
    if (st.firstRpe != null && st.lastRpe != null) bits.push(`round RPE ${st.firstRpe} → ${st.lastRpe}`);
  } else if (type === "intervals" && n) {
    const st = roundStats(log.rounds, n);
    if (st.recovery != null) bits.push(`−${Math.round(st.recovery)} bpm/rest`);
    if (st.fade != null) bits.push(`${st.fade > 0 ? "−" : "+"}${Math.abs(st.fade).toFixed(0)}% output`);
  }
  if (log.exercises?.length) bits.push(`${log.exercises.filter((e) => e.done).length}/${log.exercises.length} exercises`);
  return bits.join(" · ");
}
