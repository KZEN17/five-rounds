import type { Equipment, Injuries, PlanInput } from "./input";
import type { PhaseSplit } from "./phases";
import type { Modality } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const roundTo5 = (v: number) => Math.round(v / 5) * 5;

/** Round format: match length, 60 s rest, building towards one more round than the matches you'll fight. */
export function roundsTargets(input: PlanInput) {
  const baseline = input.fitness.baselineRounds;
  const target = Math.min(6, Math.max(baseline + 2, input.competition.matches + 1));
  // Starts at the baseline, not baseline − 1: the legacy plan's 3 → 5 (owner's call).
  const start = clamp(baseline, 2, target);
  return { start, target, workSec: Math.round(input.competition.matchMinutes * 60), restSec: 60 };
}

/**
 * Rounds for the week's hard session. They climb evenly from start to target over the build
 * weeks (short camps: every non-taper week; longer plans: specific + peak, holding before that).
 */
export function roundsByWeek(split: PhaseSplit, start: number, target: number): number[] {
  const { phases, deload, shortCamp } = split;
  const climbing = phases.flatMap((p, i) =>
    (shortCamp ? p !== "taper" : p === "specific" || p === "peak") ? [i] : [],
  );
  const delta = target - start;
  const out = phases.map(() => start);
  climbing.forEach((week, k) => {
    out[week] = start + Math.min(delta, Math.floor(((k + 1) * (delta + 1)) / (climbing.length + 1)));
  });
  const peak = Math.max(...out);
  phases.forEach((phase, i) => {
    if (phase === "taper") out[i] = shortCamp ? start : Math.max(2, Math.round(peak * 0.6));
    else if (deload[i]) out[i] = Math.max(2, Math.round((out[i] ?? start) * 0.7));
  });
  return out;
}

/**
 * Minutes for each easy aerobic session in week `k` (k = non-taper weeks before this one).
 * The week's total rises 5 min a week, the extra going to the earlier session first,
 * and no session goes past the cap.
 */
export function aerobicMinutes(sessions: number, cap: number, k: number): number[] {
  const ceiling = Math.max(cap, 20);
  const start = Math.max(20, Math.min(cap, 30));
  const steps = k; // one 5-minute step per week
  const each = Math.floor(steps / Math.max(1, sessions));
  const rem = steps % Math.max(1, sessions);
  return Array.from({ length: sessions }, (_, j) => Math.min(ceiling, start + 5 * each + (j < rem ? 5 : 0)));
}

export function aerobicStart(cap: number) {
  return Math.max(20, Math.min(cap, 30));
}

export function available(equipment: readonly Equipment[]): Set<Modality> {
  const set = new Set<Modality>();
  if (equipment.includes("bike")) set.add("bike");
  if (equipment.includes("rower")) set.add("rower");
  if (equipment.includes("assault_bike")) set.add("assault_bike");
  if (equipment.includes("treadmill") || equipment.includes("outdoor_run")) set.add("run");
  if (equipment.includes("pool")) set.add("swim");
  return set;
}

const PREFERENCE: Record<"intervals" | "aerobic", Modality[]> = {
  intervals: ["rower", "assault_bike", "bike", "run", "swim"],
  aerobic: ["bike", "rower", "run", "swim"],
};

/** Modalities to steer away from, given injuries. */
export function avoided(injuries: Injuries): Set<Modality> {
  const out = new Set<Modality>();
  if (injuries.knee || injuries.ankle) {
    out.add("run");
    out.add("assault_bike");
  }
  if (injuries.lowerBack) out.add("rower");
  if (injuries.shoulder) {
    out.add("rower");
    out.add("assault_bike");
  }
  return out;
}

/** Best machine for the job: equipment first, injuries as a filter, and a note when nothing safer exists. */
export function pickModality(
  kind: "intervals" | "aerobic",
  equipment: readonly Equipment[],
  injuries: Injuries,
): { modality: Modality; warning?: string } {
  const have = available(equipment);
  const avoid = avoided(injuries);
  const options = PREFERENCE[kind].filter((m) => have.has(m));
  const safe = options.find((m) => !avoid.has(m));
  if (safe) return { modality: safe };
  const forced = options[0];
  if (forced) {
    return {
      modality: forced,
      warning: `${MODALITY_NAME[forced]} is the only option you have for ${kind === "intervals" ? "hard intervals" : "easy aerobic work"}, and it can aggravate your injury. Keep the volume down, and swap it if it hurts.`,
    };
  }
  return { modality: kind === "intervals" ? "none" : "walk" };
}

export const MODALITY_NAME: Record<Modality, string> = {
  mat: "Mat",
  bike: "Bike",
  rower: "Rowing",
  assault_bike: "Assault bike",
  run: "Run",
  swim: "Swim",
  walk: "Brisk walk",
  gym: "Gym",
  none: "Bodyweight",
};
