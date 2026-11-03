import type { IsoDate } from "@/lib/engine";

export function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Today's calendar date where the athlete is. */
export function todayIn(tz: string, now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: isTimeZone(tz) ? tz : "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** A Date whose UTC fields are that calendar date: what the engine expects. */
export const calendarDate = (iso: IsoDate) => new Date(`${iso}T00:00:00Z`);

const fmt = (iso: IsoDate, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(calendarDate(iso));

export const shortDate = (iso: IsoDate) => fmt(iso, { day: "numeric", month: "short" });
export const longDate = (iso: IsoDate) => fmt(iso, { weekday: "short", day: "numeric", month: "short" });
