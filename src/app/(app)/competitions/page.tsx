import type { Metadata } from "next";
import { CompetitionCard } from "@/components/competitions/competition-card";
import { CompetitionForm } from "@/components/competitions/competition-form";
import { userTimezone } from "@/lib/actions";
import type { CompetitionRow } from "@/lib/db/competition-store";
import { outlookFor } from "@/lib/db/fuel-store";
import { latestInput } from "@/lib/db/plan-store";
import { addDays } from "@/lib/engine";
import { requireUser } from "@/lib/session";
import { calendarDate, todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Competitions" };

const monthLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(calendarDate(iso));

const values = (c: CompetitionRow) => ({
  id: c.id,
  name: c.name,
  date: c.date,
  gi: c.gi,
  weighIn: c.weighInTiming,
  limitKg: c.targetWeightKg,
  matchMinutes: c.matchLenSec / 60,
  matches: c.matches,
  restMinutes: c.restMin,
});

export default async function CompetitionsPage() {
  const { db } = await requireUser();
  const [input, tz] = await Promise.all([latestInput(db), userTimezone(db)]);
  const today = todayIn(tz);
  const { calendar, outlook, trend } = await outlookFor(db, today, input?.data.profile.weightKg ?? 80);
  const byId = new Map(outlook.comps.map((c) => [c.id, c]));
  const upcoming = calendar.filter((c) => c.date >= today);
  const past = calendar.filter((c) => c.date < today).reverse();
  const months = [...new Set(upcoming.map((c) => monthLabel(c.date)))];
  const main = calendar.find((c) => c.isMain);

  return (
    <>
      <div>
        <div className="eyebrow">Your season</div>
        <h2>Competitions</h2>
      </div>
      <p className="hint">
        Your plan peaks for your <b>main</b> competition. Every competition with a division limit counts towards your calories: the app compares your trend weight ({trend.trendKg} kg) with each weigh-in and sets the daily deficit for the one that needs the fastest pace, within safe limits.
      </p>

      <details className="panel" open={!upcoming.length}>
        <summary className="cursor-pointer font-semibold text-accent">Add a competition</summary>
        <div className="mt-3">
          <CompetitionForm
            initial={{
              name: "",
              date: addDays(today, 28),
              gi: main?.gi ?? "gi",
              weighIn: main?.weighInTiming ?? "same_day",
              limitKg: main?.targetWeightKg ?? null,
              matchMinutes: main ? main.matchLenSec / 60 : 5,
              matches: main?.matches ?? 4,
              restMinutes: main?.restMin ?? 20,
            }}
          />
        </div>
      </details>

      {months.length ? (
        months.map((m) => (
          <section key={m} aria-label={m} className="flex flex-col gap-2">
            <h3 className="text-muted">{m}</h3>
            <ul className="flex flex-col gap-2">
              {upcoming
                .filter((c) => monthLabel(c.date) === m)
                .map((c) => (
                  <CompetitionCard key={c.id} values={values(c)} isMain={c.isMain} outlook={byId.get(c.id)} />
                ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="hint">No upcoming competitions yet.</p>
      )}

      {past.length ? (
        <details>
          <summary className="hint cursor-pointer">Past competitions ({past.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {past.map((c) => (
              <CompetitionCard key={c.id} values={values(c)} isMain={c.isMain} past />
            ))}
          </ul>
        </details>
      ) : null}
      <p className="hint">Five Rounds never plans water cuts or dehydration. In the final week before a weigh-in, food and fluid stay normal.</p>
    </>
  );
}
