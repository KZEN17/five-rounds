import type { Phase } from "./types";

export type PhaseSplit = {
  phases: Phase[];
  deload: boolean[];
  /**
   * Plans of 8 weeks or less follow the original app's 8-week shape (owner's call): comp sim and
   * intervals alternate from week 1, no deload week, and the taper returns to week-1 volume.
   */
  shortCamp: boolean;
  taperDays: number;
};

const repeat = (phase: Phase, n: number): Phase[] => Array.from({ length: n }, () => phase);

/**
 * General ~40%, specific ~35%, peak ~15% of the non-taper weeks; the final week is the taper.
 * Over 16 weeks, the extra weeks come first as a base block. Under 3 weeks: sharpen + taper.
 */
export function splitPhases(weeks: number): PhaseSplit {
  const total = Math.max(1, Math.floor(weeks));
  const shortCamp = total <= 8;
  if (total < 3) {
    const phases: Phase[] = total === 1 ? ["taper"] : ["specific", "taper"];
    return { phases, deload: phases.map(() => false), shortCamp, taperDays: 7 };
  }
  const extra = Math.max(0, total - 16);
  const build = total - 1 - extra;
  const peak = Math.max(1, Math.round((build * 15) / 90));
  const specific = Math.max(1, Math.round((build * 35) / 90));
  const general = Math.max(0, build - peak - specific);
  const phases: Phase[] = [
    ...repeat("base", extra),
    ...repeat("general", general),
    ...repeat("specific", specific),
    ...repeat("peak", peak),
    "taper",
  ];
  // Short camps skip deloads: the taper does that job (legacy shape).
  const deload = phases.map(
    (phase, i) => !shortCamp && (i + 1) % 4 === 0 && (phase === "base" || phase === "general" || phase === "specific"),
  );
  return { phases, deload, shortCamp, taperDays: total >= 10 ? 10 : 7 };
}

export const PHASE_LABEL: Record<Phase, string> = {
  base: "Base",
  general: "General",
  specific: "Specific",
  peak: "Peak",
  taper: "Taper",
};
