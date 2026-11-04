import type { IsoDate } from "./dates";
import type { CompStatus } from "./outlook";

export type ReportTone = "great" | "good" | "mixed" | "off" | "rest";

/** Where the athlete stands against the competition setting their calories. */
export type PaceFacts = {
  compId: string;
  compName: string;
  status: CompStatus;
  requiredRateKg: number;
  trendKg: number;
  aimKg: number | null;
  daysToWeighIn: number;
} | null;

export type Report = {
  kind: "daily" | "weekly";
  periodStart: IsoDate;
  periodEnd: IsoDate;
  tone: ReportTone;
  headline: string;
  highlights: string[];
  concerns: string[];
  nextStep: string;
  /** Stored so the next report can say whether the target got closer or further. */
  pace: PaceFacts;
};

export type DayFacts = {
  date: IsoDate;
  planned: number;
  done: number;
  hardRounds: number;
  avgRpe: number | null;
  missed: string[];
  food: { logged: boolean; kcal: number; target: number; protein: number; proteinTarget: number };
  weighedIn: boolean;
  daysSinceWeighIn: number | null;
  readinessFlags: string[];
  /** Titles of the next day's sessions, for the next step. */
  nextPlan: string[];
};

export type WeekFacts = {
  start: IsoDate;
  end: IsoDate;
  planned: number;
  done: number;
  hardPlanned: number;
  hardDone: number;
  daysFoodLogged: number;
  daysOnTarget: number;
  daysOver: number;
  proteinDays: number;
  weighIns: number;
  trendStart: number | null;
  trendEnd: number | null;
  simFinalRpe: { first: number; last: number } | null;
  flaggedDays: number;
  nextWeekPlanned: number;
  nextWeekHard: number;
};

const kg = (v: number) => `${v.toFixed(2)} kg/week`;
const n0 = (v: number) => Math.round(v).toLocaleString("en-GB");
const name = (p: NonNullable<PaceFacts>) => p.compName || "your competition";

function toneFrom(score: number): ReportTone {
  if (score >= 3) return "great";
  if (score >= 1) return "good";
  if (score === 0) return "mixed";
  return "off";
}

/** Closer or further from the weight target, against the last report for the same competition. */
function paceLines(pace: PaceFacts, previousRequired: number | null) {
  const out = { score: 0, highlights: [] as string[], concerns: [] as string[] };
  if (!pace) return out;
  if (pace.status === "on_weight") {
    out.highlights.push(`On weight for ${name(pace)} (${pace.trendKg} kg).`);
    return out;
  }
  if (pace.status === "infeasible") {
    out.concerns.push(`${name(pace)}: the gap is now too big to close safely before weigh-in. Look at the next division up or a later competition.`);
    out.score -= 1;
    return out;
  }
  if (previousRequired == null || !Number.isFinite(pace.requiredRateKg)) return out;
  const delta = pace.requiredRateKg - previousRequired;
  if (delta > 0.03) {
    out.score -= 1;
    out.concerns.push(
      `Your target is getting further away: you now need ${kg(pace.requiredRateKg)} to make ${pace.aimKg} kg for ${name(pace)}, up from ${kg(previousRequired)}. The longer it slips, the harder the pace gets.`,
    );
  } else if (delta < -0.03) {
    out.score += 1;
    out.highlights.push(`Your target is getting closer: ${kg(pace.requiredRateKg)} needed for ${name(pace)}, down from ${kg(previousRequired)}.`);
  }
  return out;
}

/** "Yesterday was…": what went well, what slipped, and today's next step. Facts only, no guessing. */
export function dailyReport(f: DayFacts, pace: PaceFacts, previousRequired: number | null): Report {
  let score = 0;
  const highlights: string[] = [];
  const concerns: string[] = [];

  if (f.planned === 0) {
    highlights.push("Rest day: recovery counts too.");
  } else if (f.done === f.planned) {
    score += 2;
    const extras = [f.hardRounds ? `${f.hardRounds} hard rounds` : "", f.avgRpe ? `RPE ${f.avgRpe}` : ""].filter(Boolean).join(" at ");
    highlights.push(`All ${f.planned} session${f.planned > 1 ? "s" : ""} done${extras ? `, ${extras}` : ""}.`);
  } else if (f.done > 0) {
    highlights.push(`${f.done} of ${f.planned} sessions done.`);
    concerns.push(`Missed: ${f.missed.join(", ")}.`);
  } else {
    score -= 2;
    concerns.push(`None of the ${f.planned} planned sessions were logged (${f.missed.join(", ")}).`);
  }

  if (!f.food.logged) {
    score -= 1;
    concerns.push("No food logged, so there's no way to tell whether you hit your target.");
  } else {
    const diff = f.food.kcal - f.food.target;
    const pct = f.food.target > 0 ? diff / f.food.target : 0;
    if (Math.abs(pct) <= 0.08) {
      score += 1;
      highlights.push(`Calories on target: ${n0(f.food.kcal)} of ${n0(f.food.target)} kcal.`);
    } else if (pct > 0.08) {
      score -= 1;
      concerns.push(`${n0(diff)} kcal over target (${n0(f.food.kcal)} of ${n0(f.food.target)}).`);
    } else if (pct < -0.15) {
      concerns.push(`${n0(-diff)} kcal under target. Under-eating costs training quality.`);
    }
    if (f.food.protein >= 0.9 * f.food.proteinTarget) {
      score += 1;
      highlights.push(`Protein hit: ${n0(f.food.protein)}/${f.food.proteinTarget} g.`);
    } else {
      concerns.push(`Protein short: ${n0(f.food.protein)}/${f.food.proteinTarget} g.`);
    }
  }

  if (!f.weighedIn && (f.daysSinceWeighIn == null || f.daysSinceWeighIn >= 4)) {
    concerns.push(f.daysSinceWeighIn == null ? "No weigh-ins yet." : `No weigh-in for ${f.daysSinceWeighIn} days.`);
  }
  if (f.readinessFlags.length) concerns.push(`Readiness flagged: ${f.readinessFlags.join("; ")}.`);

  const p = paceLines(pace, previousRequired);
  score += p.score;
  highlights.push(...p.highlights);
  concerns.push(...p.concerns);

  const tone: ReportTone = f.planned === 0 && concerns.length === 0 ? "rest" : toneFrom(score);
  const headline = {
    great: "Yesterday was a great day.",
    good: "Good day yesterday.",
    mixed: "Mixed day yesterday.",
    off: "Yesterday slipped.",
    rest: "Rest day yesterday.",
  }[tone];
  const today = f.nextPlan.length ? `Today: ${f.nextPlan.join(" + ")}.` : "Today is a rest day: walk, eat well, sleep.";
  const nextStep =
    tone === "off"
      ? `${today} One good day turns the trend around.`
      : !f.food.logged
        ? `${today} Log your food as you go.`
        : !f.weighedIn && (f.daysSinceWeighIn ?? 99) >= 4
          ? `${today} Weigh in tomorrow morning.`
          : today;

  return { kind: "daily", periodStart: f.date, periodEnd: f.date, tone, headline, highlights, concerns, nextStep, pace };
}

/** "Last week…": completion, food, weight and the pace against the target. */
export function weeklyReport(f: WeekFacts, pace: PaceFacts, previousRequired: number | null): Report {
  let score = 0;
  const highlights: string[] = [];
  const concerns: string[] = [];
  const completion = f.planned ? f.done / f.planned : 1;

  if (f.planned) {
    const line = `${f.done}/${f.planned} sessions done (${Math.round(completion * 100)}%)${f.hardPlanned ? `, ${f.hardDone}/${f.hardPlanned} hard ones` : ""}.`;
    if (completion >= 0.9) {
      score += 2;
      highlights.push(line);
    } else if (completion >= 0.7) {
      score += 1;
      highlights.push(line);
    } else {
      if (completion < 0.5) score -= 2;
      concerns.push(line);
    }
  }

  if (f.daysFoodLogged < 4) {
    score -= 1;
    concerns.push(`Food logged on only ${f.daysFoodLogged} of 7 days.`);
  } else {
    if (f.daysOnTarget >= 5) {
      score += 1;
      highlights.push(`Calories on target ${f.daysOnTarget} of 7 days.`);
    }
    if (f.daysOver >= 3) {
      score -= 1;
      concerns.push(`Over your calorie target on ${f.daysOver} days.`);
    }
    if (f.proteinDays >= 5) highlights.push(`Protein hit on ${f.proteinDays} days.`);
  }

  if (f.trendStart != null && f.trendEnd != null) {
    const change = Math.round((f.trendEnd - f.trendStart) * 10) / 10;
    const cutting = pace && pace.status !== "on_weight" && pace.status !== "no_limit";
    if (cutting && change <= -0.8 * pace.requiredRateKg && change < 0) {
      score += 1;
      highlights.push(`Trend weight ${change} kg: right on pace for ${name(pace)}.`);
    } else if (cutting && change > 0) {
      score -= 1;
      concerns.push(`Trend weight went up ${change} kg while you need to lose ${kg(pace.requiredRateKg)}.`);
    } else if (change !== 0) {
      highlights.push(`Trend weight ${change > 0 ? "+" : ""}${change} kg.`);
    }
  }
  if (f.weighIns < 3) concerns.push(`Only ${f.weighIns} weigh-in${f.weighIns === 1 ? "" : "s"}: aim for most mornings so the trend is reliable.`);
  if (f.simFinalRpe && f.simFinalRpe.last < f.simFinalRpe.first) {
    score += 1;
    highlights.push(`Comp-sim final round down from RPE ${f.simFinalRpe.first} to ${f.simFinalRpe.last}: the gas tank is growing.`);
  }
  if (f.flaggedDays >= 2) concerns.push(`Readiness flagged on ${f.flaggedDays} days: sleep and recovery need attention.`);

  const p = paceLines(pace, previousRequired);
  score += p.score;
  highlights.push(...p.highlights);
  concerns.push(...p.concerns);

  const tone = toneFrom(score);
  const headline = { great: "Last week was great progress.", good: "Good week.", mixed: "Mixed week.", off: "Last week slipped.", rest: "Quiet week." }[tone];
  const plan = f.nextWeekPlanned ? `This week: ${f.nextWeekPlanned} sessions, ${f.nextWeekHard} of them hard.` : "This week is light.";
  const nextStep = tone === "off" ? `${plan} Start with today's session and log everything.` : plan;
  return { kind: "weekly", periodStart: f.start, periodEnd: f.end, tone, headline, highlights, concerns, nextStep, pace };
}

/** One-line push text: the headline as the title, the best and worst point as the body. */
export function pushText(r: Report): { title: string; body: string } {
  const body = [r.highlights[0], r.concerns[0], r.nextStep].filter(Boolean).join(" ");
  return { title: r.headline, body: body.length > 220 ? `${body.slice(0, 217)}…` : body };
}
