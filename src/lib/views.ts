import type { LogRow, SessionRow } from "@/lib/db/plan-store";
import { weekdayOf, type Exercise, type IsoDate, type Modality, type SessionType } from "@/lib/engine";

export type LogView = Pick<
  LogRow,
  "done" | "minutes" | "avgHr" | "maxHr" | "rpe" | "hardRounds" | "outputUnit" | "rounds" | "exercises" | "notes"
>;

export type SessionView = {
  id: string;
  type: SessionType;
  title: string;
  timeOfDay: "morning" | "midday" | "evening" | null;
  minutes?: number;
  rounds?: number;
  workSec?: number;
  restSec?: number;
  modality: Modality;
  intensity: "easy" | "moderate" | "hard";
  purpose: string;
  notes: string;
  exercises?: Exercise[];
  log: LogView | null;
};

export type DayView = { date: IsoDate; weekday: number; isToday: boolean; edited: boolean; beforeStart: boolean; sessions: SessionView[] };

type Row = { session: SessionRow; log: LogRow | null };

export function toSessionView({ session: s, log }: Row): SessionView {
  const p = s.params;
  return {
    id: s.id,
    type: s.type,
    title: s.title,
    timeOfDay: s.timeOfDay,
    ...(p.minutes != null ? { minutes: p.minutes } : {}),
    ...(p.rounds != null ? { rounds: p.rounds } : {}),
    ...(p.workSec != null ? { workSec: p.workSec } : {}),
    ...(p.restSec != null ? { restSec: p.restSec } : {}),
    modality: p.modality,
    intensity: p.intensity,
    purpose: p.purpose,
    notes: p.notes,
    ...(p.exercises ? { exercises: p.exercises } : {}),
    log: log
      ? {
          done: log.done,
          minutes: log.minutes,
          avgHr: log.avgHr,
          maxHr: log.maxHr,
          rpe: log.rpe,
          hardRounds: log.hardRounds,
          outputUnit: log.outputUnit,
          rounds: log.rounds,
          exercises: log.exercises,
          notes: log.notes,
        }
      : null,
  };
}

/**
 * Day views for a run of dates. A day is "edited" when a session was changed or added
 * by the athlete, or one of this plan's sessions was removed.
 */
export function buildDays(
  rows: readonly Row[],
  dates: readonly IsoDate[],
  planId: string | undefined,
  today: IsoDate,
  planStart: IsoDate = dates[0] ?? today,
): DayView[] {
  return dates.map((date) => {
    const onDay = rows.filter((r) => r.session.date === date);
    const live = onDay.filter((r) => !r.session.deletedAt);
    const edited =
      live.some((r) => r.session.source !== "generated") ||
      onDay.some((r) => r.session.deletedAt && r.session.planId != null && r.session.planId === planId);
    return { date, weekday: weekdayOf(date), isToday: date === today, edited, beforeStart: date < planStart, sessions: live.map(toSessionView) };
  });
}
