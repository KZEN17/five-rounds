import { daysBetween, type IsoDate } from "./dates";
import type { Modality, Session } from "./types";

export type ReadinessEntry = {
  date: IsoDate;
  sleepH?: number | null;
  rhr?: number | null;
  hrv?: number | null;
  soreness?: number | null;
  mood?: number | null;
};

export type ReadinessFlag = { code: "sleep" | "rhr" | "hrv"; message: string };

export type Readiness = {
  hasData: boolean;
  baseline: { rhr: number | null; hrv: number | null; entries: number };
  flags: ReadinessFlag[];
};

const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Compares today with the trailing 7 days. A baseline needs at least 3 entries. */
export function readinessFlags(today: ReadinessEntry | undefined, history: readonly ReadinessEntry[], date: IsoDate): Readiness {
  const week = history.filter((e) => {
    const ago = daysBetween(e.date, date);
    return ago >= 1 && ago <= 7;
  });
  const avg = (key: "rhr" | "hrv") => {
    const values = week.map((e) => e[key]).filter(num);
    return values.length >= 3 ? mean(values) : null;
  };
  const baseline = { rhr: avg("rhr"), hrv: avg("hrv"), entries: week.length };
  const flags: ReadinessFlag[] = [];
  const t = today ?? { date };
  if (num(t.sleepH) && t.sleepH < 7) flags.push({ code: "sleep", message: `${t.sleepH} h sleep, under 7` });
  if (num(t.rhr) && baseline.rhr != null && t.rhr >= baseline.rhr + 5) {
    flags.push({ code: "rhr", message: `resting HR ${Math.round(t.rhr - baseline.rhr)} bpm above your 7-day average` });
  }
  if (num(t.hrv) && baseline.hrv != null && t.hrv <= baseline.hrv * 0.85) {
    flags.push({ code: "hrv", message: `HRV ${Math.round((1 - t.hrv / baseline.hrv) * 100)}% below your 7-day average` });
  }
  return { hasData: num(t.sleepH) || num(t.rhr) || num(t.hrv), baseline, flags };
}

export type Suggestion = { index: number; from: Session; to: Session; reason: string };

/**
 * Suggested swaps for a flagged day. It only suggests; the athlete decides.
 * Intervals → mobility, comp sim → easy aerobic, hard BJJ → technical. On a
 * badly flagged day (2+ flags, or 2+ hard days in the last 3) strength becomes mobility too.
 */
export function adjustDay(
  day: { date: IsoDate; sessions: readonly Session[] },
  readiness: Pick<Readiness, "flags">,
  recentLoad: { hardDaysLast3: number },
  opts: { easyModality?: Modality } = {},
): Suggestion[] {
  if (readiness.flags.length === 0) return [];
  const heavy = readiness.flags.length >= 2 || recentLoad.hardDaysLast3 >= 2;
  const reason = readiness.flags.map((f) => f.message).join("; ");
  const out: Suggestion[] = [];
  day.sessions.forEach((s, index) => {
    if (s.type === "intervals") out.push({ index, from: s, to: mobility(), reason });
    else if (s.type === "comp_sim") out.push({ index, from: s, to: easyAerobic(opts.easyModality ?? "bike"), reason });
    else if (s.type === "bjj") out.push({ index, from: s, to: technical(s), reason });
    else if (heavy && s.type === "strength" && s.variant !== "primer") out.push({ index, from: s, to: mobility(), reason });
  });
  return out;
}

function mobility(): Session {
  return {
    type: "mobility",
    title: "Mobility",
    minutes: 30,
    intensity: "easy",
    modality: "none",
    purpose: "Recover today so tomorrow counts.",
    notes: "Swapped in for a hard session because your readiness was flagged.",
  };
}

function easyAerobic(modality: Modality): Session {
  const name = modality === "walk" ? "Brisk walk" : modality === "rower" ? "Rowing" : modality === "run" ? "Run" : modality === "swim" ? "Swim" : "Bike";
  return {
    type: "aerobic",
    title: `${name} 30 min`,
    minutes: 30,
    intensity: "easy",
    modality,
    purpose: "Zone 2: RPE 3–4, conversational.",
    notes: "Swapped in for the comp sim because your readiness was flagged.",
  };
}

function technical(s: Session): Session {
  return {
    ...s,
    type: "bjj_technical",
    title: "Technical BJJ",
    intensity: "moderate",
    purpose: "Drill and flow only today.",
    notes: "Readiness flagged: skip hard rounds, drill and flow-roll.",
  };
}
