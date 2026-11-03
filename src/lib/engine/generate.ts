import { aerobicMinutes, aerobicStart, pickModality, roundTo5, roundsByWeek, roundsTargets } from "./conditioning";
import { addDays, daysBetween, mondayOf, toIso } from "./dates";
import type { PlanInput } from "./input";
import { planNutrition } from "./nutrition";
import { splitPhases } from "./phases";
import { scheduleWeek, type HardKind } from "./schedule";
import type { Phase, Plan, PlanWeek, Warning } from "./types";

const STRENGTH_PER_PHASE: Record<Phase, number> = { base: 2, general: 2, specific: 2, peak: 1, taper: 0 };

function hardPlan(phase: Phase, week: number, phaseWeek: number, shortCamp: boolean, deload: boolean): HardKind[] {
  if (shortCamp) {
    // The legacy shape: one hard session a week, comp sim and intervals alternating from week 1.
    if (phase === "peak") return ["comp_sim"];
    return [week % 2 === 0 ? "comp_sim" : "intervals"];
  }
  let plan: HardKind[];
  if (phase === "base" || phase === "general") plan = ["threshold"];
  else if (phase === "specific") plan = [phaseWeek % 2 === 0 ? "comp_sim" : "intervals", "threshold"];
  else if (phase === "peak") plan = ["comp_sim", "intervals"];
  else plan = ["intervals"];
  return deload ? plan.slice(0, 1) : plan;
}

/**
 * The whole plan from the athlete's answers. Pure and deterministic: the same input and
 * `today` (read as a calendar date) always give the same plan.
 */
export function generatePlan(input: PlanInput, today: Date): Plan {
  const todayIso = toIso(today);
  const start = mondayOf(todayIso);
  const comp = input.competition.date;
  const warnings: Warning[] = [];
  const add = (w: Warning) => {
    if (!warnings.some((x) => x.code === w.code)) warnings.push(w);
  };

  if (daysBetween(todayIso, comp) < 1) {
    add({ code: "comp-past", message: "Your competition date is today or already past. Set a new date to get a plan." });
  }
  const weeks = Math.max(1, Math.ceil(daysBetween(start, comp) / 7));
  if (weeks < 3) {
    add({
      code: "short-plan",
      message: "Less than 3 weeks to go: this is a short sharpen-and-taper plan. There's no time to build fitness, only to sharpen it.",
    });
  }

  const split = splitPhases(weeks);
  const rt = roundsTargets(input);
  const rounds = roundsByWeek(split, rt.start, rt.target);
  const taperRounds = rounds[rounds.length - 1] ?? rt.start;

  const interval = pickModality("intervals", input.equipment, input.profile.injuries);
  const easy = pickModality("aerobic", input.equipment, input.profile.injuries);
  for (const w of [interval.warning, easy.warning]) if (w) add({ code: "injury-modality", message: w });

  const cap = input.availability.extraMinutes;
  const s0 = aerobicStart(cap);
  const buildWeeks = split.phases.filter((p) => p !== "taper").length;
  const strengthDays = input.strength.daysPerWeek;

  const out: PlanWeek[] = [];
  const phaseWeek: Partial<Record<Phase, number>> = {};
  let k = 0; // build weeks so far: drives the aerobic progression
  for (let w = 0; w < weeks; w++) {
    const phase = split.phases[w] ?? "taper";
    const deload = split.deload[w] ?? false;
    const pw = phaseWeek[phase] ?? 0;
    const weekK = k;
    const aerobic = (n: number, taper: boolean): number[] => {
      if (taper) {
        if (split.shortCamp) return Array.from({ length: n }, () => s0);
        // Taper: −40 to −60% conditioning volume, same intensity.
        const peak = aerobicMinutes(n, cap, Math.max(0, buildWeeks - 1));
        return peak.map((m) => roundTo5(Math.max(20, m * 0.45)));
      }
      const mins = aerobicMinutes(n, cap, weekK);
      return deload ? mins.map((m) => roundTo5(Math.max(20, m * 0.7))) : mins;
    };
    const thresholdRounds = Math.max(2, Math.round((pw >= 2 ? 4 : 3) * (deload ? 0.7 : 1)));
    // Hard sessions count against the extra-session cap; past it the second one goes.
    const wanted = hardPlan(phase, w, pw, split.shortCamp, deload);
    const hard = wanted.slice(0, input.availability.extraSessions);
    if (hard.length < wanted.length) {
      add({
        code: "hard-capped",
        message: `With ${input.availability.extraSessions} extra session a week there's room for one hard conditioning session. The second one this phase calls for is dropped.`,
      });
    }
    const { days, warnings: weekWarnings } = scheduleWeek({
      input,
      dates: Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)),
      today: todayIso,
      comp,
      phase,
      deload,
      taperDays: split.taperDays,
      hardPlan: hard,
      rounds: rounds[w] ?? rt.start,
      taperRounds,
      thresholdRounds,
      workSec: rt.workSec,
      restSec: rt.restSec,
      aerobic,
      strengthCount: Math.min(strengthDays, STRENGTH_PER_PHASE[phase]),
      intervalModality: interval.modality,
      aerobicModality: easy.modality,
    });
    weekWarnings.forEach(add);
    out.push({ index: w + 1, start: addDays(start, w * 7), phase, deload, days });
    phaseWeek[phase] = pw + 1;
    if (phase !== "taper") k++;
  }

  const nutrition = planNutrition(input, weeks, comp);
  return {
    engineVersion: 1,
    generatedOn: todayIso,
    start,
    compDate: comp,
    shortCamp: split.shortCamp,
    rounds: rt,
    weeks: out,
    nutrition,
    warnings,
  };
}
