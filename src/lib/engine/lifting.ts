import type { Exercise, Pattern } from "./types";

export type SetLog = { kg: number | null; reps: number | null };

export const roundToPlate = (kg: number) => Math.round(kg / 2.5) * 2.5;

/** Estimated one-rep max (Epley). Sets above 12 reps say little about strength, so they're ignored. */
export function e1rm(kg: number, reps: number): number {
  if (kg <= 0 || reps <= 0 || reps > 12) return 0;
  return Math.round(kg * (1 + reps / 30) * 10) / 10;
}

/** The set with the highest estimated max. */
export function bestSet(sets: readonly SetLog[]): { kg: number; reps: number; e1rm: number } | null {
  let best: { kg: number; reps: number; e1rm: number } | null = null;
  for (const s of sets) {
    if (s.kg == null || s.reps == null) continue;
    const est = e1rm(s.kg, s.reps);
    if (est > 0 && (!best || est > best.e1rm)) best = { kg: s.kg, reps: s.reps, e1rm: est };
  }
  return best;
}

/**
 * Next time's weight from last time's sets: every rep hit → add the increment; two or
 * more reps short anywhere → stay; otherwise stay and aim to hit them all.
 */
export function suggestNext(target: Pick<Exercise, "sets" | "reps" | "increment">, last: readonly SetLog[]): { kg: number; note: string } | null {
  const worked = last.filter((s) => s.kg != null && s.kg > 0 && s.reps != null);
  if (!target.reps || worked.length === 0) return null;
  const top = Math.max(...worked.map((s) => s.kg!));
  const atTop = worked.filter((s) => s.kg === top);
  const wanted = target.sets ?? atTop.length;
  const allHit = atTop.length >= wanted && atTop.every((s) => s.reps! >= target.reps!);
  if (allHit && target.increment) {
    const next = roundToPlate(top + target.increment);
    return { kg: next, note: `Every rep hit last time: try ${next} kg.` };
  }
  if (worked.some((s) => s.reps! <= target.reps! - 2)) {
    return { kg: top, note: `Stay at ${top} kg until you get all ${wanted} × ${target.reps}.` };
  }
  return { kg: top, note: allHit ? `Same ${top} kg: keep it crisp.` : `Same ${top} kg: aim for all ${wanted} × ${target.reps}.` };
}

/** What each movement can be swapped for in the gym. */
export const ALTERNATIVES: Record<Pattern, string[]> = {
  squat: ["Back squat", "Front squat", "Safety-bar squat", "Goblet squat", "Leg press"],
  hinge: ["Deadlift", "Trap-bar deadlift", "Romanian deadlift", "Hip thrust"],
  push_h: ["Bench press", "Dumbbell bench press", "Incline dumbbell press", "Push-ups"],
  push_v: ["Overhead press", "Push press", "Dumbbell shoulder press", "Landmine press"],
  pull_h: ["Barbell row", "Dumbbell row", "Seated cable row", "Chest-supported row"],
  pull_v: ["Pull-ups", "Chin-ups", "Lat pulldown"],
  single_leg: ["Bulgarian split squat", "Split squat", "Walking lunge", "Step-up", "ATG split squat"],
  core: ["Hanging knee raise", "Pallof press", "Ab wheel", "Copenhagen plank"],
  power: ["Box jump", "Jump squat", "Med-ball slam", "Broad jump"],
  prehab: [],
};

export function alternativesFor(ex: Exercise): string[] {
  if (!ex.pattern) return [];
  const list = ALTERNATIVES[ex.pattern];
  return list.includes(ex.name) ? list : [ex.name, ...list];
}
