import { daysBetween, type IsoDate } from "./dates";
import type { PlanInput } from "./input";
import * as S from "./sessions";
import { mobilitySession, strengthSession } from "./strength";
import type { Modality, Phase, PlanDay, Session, Warning } from "./types";

export type HardKind = "comp_sim" | "intervals" | "threshold";

export type WeekParams = {
  input: PlanInput;
  dates: IsoDate[];
  today: IsoDate;
  comp: IsoDate;
  phase: Phase;
  deload: boolean;
  taperDays: number;
  hardPlan: HardKind[];
  rounds: number;
  taperRounds: number;
  thresholdRounds: number;
  workSec: number;
  restSec: number;
  /** Minutes for `n` aerobic sessions this week, or at taper volume. */
  aerobic: (n: number, taper: boolean) => number[];
  strengthCount: number;
  intervalModality: Modality;
  aerobicModality: Modality;
};

type Slot = { date: IsoDate; weekday: number; usable: boolean; sessions: Session[]; rest: boolean };

const isHardConditioning = (s: Session) => s.type === "comp_sim" || s.type === "intervals";
const mod7 = (i: number) => ((i % 7) + 7) % 7;

/** Picks up to `k` days in the given order, preferring a day's gap between picks. */
export function spread(candidates: readonly number[], k: number): number[] {
  const picked: number[] = [];
  for (const d of candidates) if (picked.length < k && picked.every((p) => Math.abs(p - d) >= 2)) picked.push(d);
  for (const d of candidates) if (picked.length < k && !picked.includes(d)) picked.push(d);
  return picked;
}

/** Lays out one week: anchors, hard sessions, rest day, easy aerobic, then strength. */
export function scheduleWeek(p: WeekParams): { days: PlanDay[]; warnings: Warning[] } {
  const { input } = p;
  const warnings: Warning[] = [];
  const warn = (code: string, message: string) => warnings.push({ code, message });
  const toComp = (d: IsoDate) => daysBetween(d, p.comp);
  const inTaper = (d: IsoDate) => p.phase === "taper" || toComp(d) <= p.taperDays;
  const slots: Slot[] = p.dates.map((date, weekday) => ({
    date,
    weekday,
    usable: date >= p.today && toComp(date) > 0,
    sessions: [],
    rest: false,
  }));
  const fullWeek = slots.every((s) => s.usable);
  const time = input.availability.preferredTime === "any" ? undefined : input.availability.preferredTime;
  const extra = (s: Session): Session => (time ? { ...s, timeOfDay: time } : s);

  // 1. Competition day, then the fixed anchors: classes and open mat.
  for (const s of slots) if (toComp(s.date) === 0) s.sessions.push(S.competition(input));
  const hardBjj = new Set(input.availability.bjj.filter((c) => c.intensity === "hard").map((c) => c.day));
  for (const c of input.availability.bjj) {
    const s = slots[c.day];
    if (!s?.usable) continue;
    s.sessions.push(toComp(s.date) === 1 ? S.dayBeforeComp() : S.bjj(c.intensity));
  }
  const openMatDay = input.availability.openMatDay;
  const openSlot = openMatDay == null ? undefined : slots[openMatDay];
  if (openSlot?.usable && toComp(openSlot.date) > 1) openSlot.sessions.push(S.openMat());

  // 2. Hard conditioning, only on legal days.
  const hasHard = (s: Slot | undefined) => Boolean(s?.sessions.some(isHardConditioning));
  const hardAt = (i: number) => hardBjj.has(mod7(i)) || hasHard(slots[mod7(i)]);
  const legal = (i: number) => {
    const s = slots[i];
    if (!s?.usable || toComp(s.date) <= 1 || hasHard(s)) return false;
    if (hardBjj.has(i) || hardBjj.has(mod7(i + 1))) return false; // not on, or the day before, a hard class
    if (hasHard(slots[mod7(i - 1)]) || hasHard(slots[mod7(i + 1)])) return false; // a day apart
    const hard = (j: number) => j === i || hardAt(j);
    for (let a = i - 2; a <= i; a++) if (hard(a) && hard(a + 1) && hard(a + 2)) return false; // never 3 in a row
    return true;
  };
  const noMat = slots.filter((s) => !s.sessions.some((x) => x.modality === "mat")).map((s) => s.weekday).reverse();
  const technical = slots.filter((s) => s.sessions.some((x) => x.type === "bjj_technical")).map((s) => s.weekday);
  const candidates = (kind: HardKind) => {
    const list = [...(openMatDay == null ? [] : [openMatDay]), ...noMat, ...(kind === "comp_sim" ? [] : technical)];
    return [...new Set(list)];
  };

  let placed = 0;
  for (const kind of p.hardPlan) {
    const day = candidates(kind).find(legal);
    const s = day === undefined ? undefined : slots[day];
    if (!s) {
      if (fullWeek) {
        warn("hard-dropped", "Your BJJ schedule leaves room for fewer hard conditioning sessions than this phase calls for. The plan keeps the ones that fit safely.");
      }
      continue;
    }
    const replacesOpenMat = s.sessions.some((x) => x.type === "open_mat");
    s.sessions = s.sessions.filter((x) => x.type !== "open_mat");
    const rounds = inTaper(s.date) ? p.taperRounds : p.rounds;
    let session: Session;
    if (kind === "comp_sim") session = S.compSim(rounds, p.workSec, p.restSec, replacesOpenMat);
    else if (kind === "threshold") session = extra(S.threshold(p.intervalModality, p.thresholdRounds));
    else {
      let r = rounds;
      while (r > 2 && S.roundsMinutes(r, p.workSec, p.restSec, 15) > input.availability.extraMinutes) r--;
      if (r < rounds) warn("intervals-cap", `Your ${input.availability.extraMinutes}-minute cap trims some interval sessions to ${r} rounds.`);
      session = extra(S.intervals(p.intervalModality, r, p.workSec, p.restSec, replacesOpenMat));
    }
    if (p.deload) session = { ...session, notes: `${session.notes} Deload week: lighter on purpose.`.trim() };
    s.sessions.push(session);
    placed++;
  }

  // 3. One full rest or recovery-walk day: Sunday if it's free.
  const empty = slots.filter((s) => s.usable && s.sessions.length === 0);
  const restSlot = empty.find((s) => s.weekday === 6) ?? empty[empty.length - 1];
  if (restSlot) {
    restSlot.rest = true;
    restSlot.sessions.push(mobilitySession(input.strength.style), S.walk());
  } else if (fullWeek) {
    warn("no-rest-day", "Every day has training. Keep at least one full rest or recovery-walk day each week.");
  }

  // 4. Easy aerobic on free days, then after technical classes. Extras left after hard sessions.
  const n = Math.max(0, input.availability.extraSessions - placed);
  if (n > 0) {
    const free = slots.filter((s) => s.usable && !s.rest && s.sessions.length === 0).map((s) => s.weekday);
    const afterClass = slots
      .filter((s) => s.usable && !s.rest && !hasHard(s) && s.sessions.some((x) => x.type === "bjj_technical"))
      .map((s) => s.weekday);
    const picks = spread(free, n);
    for (const d of afterClass) if (picks.length < n && !picks.includes(d)) picks.push(d);
    picks.sort((a, b) => a - b);
    if (picks.length < n && fullWeek) {
      warn("aerobic-dropped", "There aren't enough free days for all your easy aerobic sessions. Extra aerobic minutes are dropped first.");
    }
    const normal = p.aerobic(picks.length, false);
    const taper = p.aerobic(picks.length, true);
    picks.forEach((d, j) => {
      const s = slots[d]!;
      const minutes = (inTaper(s.date) ? taper[j] : normal[j]) ?? 30;
      s.sessions.push(extra(S.aerobic(p.aerobicModality, minutes)));
    });
  }

  // 5. Strength: with easy days or classes, never the day before a comp sim or on a hard-conditioning day.
  const style = input.strength.style;
  const dayBeforeSim = (i: number) => i < 6 && Boolean(slots[i + 1]?.sessions.some((x) => x.type === "comp_sim"));
  const strengthOk = (s: Slot) =>
    s.usable && !s.rest && !hasHard(s) && !dayBeforeSim(s.weekday) && !s.sessions.some((x) => x.type === "competition");
  const rank = (s: Slot) =>
    s.sessions.some((x) => x.type === "aerobic") ? 0 : s.sessions.some((x) => x.type === "bjj_technical") ? 1 : s.sessions.some((x) => x.type === "bjj") ? 2 : 3;
  const ranked = slots.filter(strengthOk).sort((a, b) => rank(a) - rank(b) || a.weekday - b.weekday);
  const heavyDays = ranked.filter((s) => toComp(s.date) >= 7).map((s) => s.weekday);
  const strengthDays = spread(heavyDays, p.strengthCount);
  if (strengthDays.length < p.strengthCount && fullWeek && p.phase !== "taper") {
    warn("strength-dropped", "Not every strength session fits around your training this week. The second one is dropped first.");
  }
  for (const d of strengthDays) {
    slots[d]!.sessions.push(
      strengthSession(style, p.phase, input.strength.sessionMinutes, input.strength.customExercises, { deload: p.deload }),
    );
  }
  // ATG keeps its usual days as mobility when strength steps down (peak, taper).
  const usual = Math.min(2, input.strength.daysPerWeek);
  if (style === "atg" && strengthDays.length < usual) {
    const rest = spread(
      ranked.map((s) => s.weekday).filter((d) => !strengthDays.includes(d)),
      usual - strengthDays.length,
    );
    for (const d of rest) slots[d]!.sessions.push(mobilitySession(style));
  } else if (p.phase === "taper" && style !== "custom" && input.strength.daysPerWeek > 0) {
    const primerDay = ranked.find((s) => toComp(s.date) >= 3 && toComp(s.date) <= 6);
    if (primerDay) {
      primerDay.sessions.push(strengthSession(style, p.phase, input.strength.sessionMinutes, [], { primer: true }));
    }
  }

  return {
    days: slots.map((s) => ({
      date: s.date,
      weekday: s.weekday,
      sessions: [...s.sessions].sort((a, b) => DISPLAY_ORDER.indexOf(a.type) - DISPLAY_ORDER.indexOf(b.type)),
      rest: s.rest,
    })),
    warnings,
  };
}

/** Within a day: the class or main session first, then strength/mobility, then easy work (as in the legacy app). */
const DISPLAY_ORDER: Session["type"][] = [
  "competition",
  "bjj",
  "bjj_technical",
  "open_mat",
  "comp_sim",
  "intervals",
  "strength",
  "mobility",
  "aerobic",
  "walk",
  "custom",
];
