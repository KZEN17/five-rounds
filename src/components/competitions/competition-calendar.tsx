"use client";

import { useState } from "react";
import { addDays, daysBetween, WEEKDAYS, weekdayOf, type CompOutlook } from "@/lib/engine";
import { calendarDate, longDate, shortDate } from "@/lib/time";
import { CompetitionCard } from "./competition-card";
import { CompetitionForm, type CompetitionValues } from "./competition-form";
import { StatusTag } from "./outlook-list";

export type CalendarEntry = Required<Pick<CompetitionValues, "id">> & CompetitionValues & { isMain: boolean; outlook?: CompOutlook };

const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;
const shiftMonth = (first: string, n: number) => {
  const d = calendarDate(first);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
const monthTitle = (first: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(calendarDate(first));
const daysInMonth = (first: string) => daysBetween(first, shiftMonth(first, 1));

/** Month view of the season: tap a day to see its competitions or add one on that date. */
export function CompetitionCalendar({ entries, today, defaults }: { entries: CalendarEntry[]; today: string; defaults: CompetitionValues }) {
  const next = entries.find((e) => e.date >= today);
  const [selected, setSelected] = useState(next?.date ?? today);
  const [month, setMonth] = useState(firstOfMonth(next?.date ?? today));
  const [adding, setAdding] = useState(false);

  const byDate = new Map<string, CalendarEntry[]>();
  for (const e of entries) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  const lead = weekdayOf(month);
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth(month) }, (_, i) => addDays(month, i))];
  const onDay = byDate.get(selected) ?? [];
  const upcoming = entries.filter((e) => e.date >= today);

  const pick = (date: string) => {
    setSelected(date);
    setMonth(firstOfMonth(date));
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="panel" aria-label="Competition calendar">
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="btn btn-small" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <h3 aria-live="polite">{monthTitle(month)}</h3>
          <button type="button" className="btn btn-small" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center" role="group" aria-label={monthTitle(month)}>
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase" aria-hidden>
              {d.slice(0, 2)}
            </div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={`blank-${i}`} />;
            const comps = byDate.get(date) ?? [];
            const isSel = date === selected;
            const isToday = date === today;
            const past = date < today;
            const label = `${longDate(date)}${comps.length ? `: ${comps.map((c) => `${c.name || "Competition"}${c.isMain ? " (main)" : ""}`).join(", ")}` : ""}`;
            return (
              <button
                key={date}
                type="button"
                aria-label={label}
                aria-pressed={isSel}
                onClick={() => pick(date)}
                className={`relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-[10px] text-sm font-semibold ${
                  isSel
                    ? "bg-accent text-accent-ink"
                    : comps.length
                      ? "bg-accent-soft text-fg"
                      : past
                        ? "text-muted"
                        : "text-fg"
                } ${isToday && !isSel ? "ring-2 ring-accent ring-inset" : ""}`}
              >
                <span className="num text-[17px] leading-none">{Number(date.slice(8))}</span>
                {comps.length ? (
                  <span className="mt-1 flex gap-0.5" aria-hidden>
                    {comps.slice(0, 3).map((c) => (
                      <i
                        key={c.id}
                        className={`size-1.5 rounded-full ${isSel ? "bg-accent-ink" : c.isMain ? "bg-accent" : past ? "bg-muted" : "bg-fg"}`}
                      />
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="hint flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <i className="size-1.5 rounded-full bg-accent" /> Main
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="size-1.5 rounded-full bg-fg" /> Other
            </span>
          </p>
          <button type="button" className="btn btn-small" onClick={() => pick(today)}>
            Today
          </button>
        </div>
      </section>

      <section aria-labelledby="day-heading" className="flex flex-col gap-2">
        <h3 id="day-heading">{longDate(selected)}</h3>
        {onDay.length ? (
          <ul className="flex flex-col gap-2">
            {onDay.map((e) => (
              <CompetitionCard key={e.id} values={e} isMain={e.isMain} outlook={e.outlook} past={e.date < today} />
            ))}
          </ul>
        ) : (
          <p className="hint">No competition on this day.</p>
        )}
        {selected >= today ? (
          adding ? (
            <div className="panel">
              <CompetitionForm key={selected} initial={{ ...defaults, date: selected }} onDone={() => setAdding(false)} cancellable />
            </div>
          ) : (
            <button type="button" className="btn btn-primary self-start" onClick={() => setAdding(true)}>
              Add a competition on {shortDate(selected)}
            </button>
          )
        ) : null}
      </section>

      {upcoming.length ? (
        <section className="panel" aria-labelledby="upcoming-heading">
          <h3 id="upcoming-heading">Upcoming</h3>
          <ul className="flex flex-col">
            {upcoming.map((e) => (
              <li key={e.id} className="border-t border-line first:border-t-0">
                <button type="button" onClick={() => pick(e.date)} className="flex min-h-12 w-full items-center gap-3 py-2 text-left">
                  <span className="w-12 shrink-0 text-center font-display leading-none uppercase">
                    <b className="block text-xl">{Number(e.date.slice(8))}</b>
                    <span className="font-body text-[11px] text-muted">{shortDate(e.date).split(" ")[1]}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">
                      {e.name || "Competition"}
                      {e.isMain ? <span className="tag ml-1.5 bg-accent text-accent-ink">Main</span> : null}
                    </b>
                    <span className="hint">
                      {WEEKDAYS[weekdayOf(e.date)]} · in {daysBetween(today, e.date)} days{e.limitKg != null ? ` · limit ${e.limitKg} kg` : ""}
                    </span>
                  </span>
                  {e.outlook ? <StatusTag status={e.outlook.status} /> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
