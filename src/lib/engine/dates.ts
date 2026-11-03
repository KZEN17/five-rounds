/** Calendar dates as `yyyy-mm-dd`. All maths is done in UTC so results never depend on the machine's time zone. */
export type IsoDate = string;

const DAY_MS = 86_400_000;

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** The calendar date of `date`, read from its UTC fields. */
export function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function isoToMs(iso: IsoDate): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return toIso(new Date(isoToMs(iso) + days * DAY_MS));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((isoToMs(to) - isoToMs(from)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(iso: IsoDate): number {
  return (new Date(isoToMs(iso)).getUTCDay() + 6) % 7;
}

export function mondayOf(iso: IsoDate): IsoDate {
  return addDays(iso, -weekdayOf(iso));
}
