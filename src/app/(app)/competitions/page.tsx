import type { Metadata } from "next";
import { CompetitionCalendar } from "@/components/competitions/competition-calendar";
import { OutlookList } from "@/components/competitions/outlook-list";
import { userTimezone } from "@/lib/actions";
import { outlookFor } from "@/lib/db/fuel-store";
import { latestInput } from "@/lib/db/plan-store";
import { requireUser } from "@/lib/session";
import { todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Competitions" };

export default async function CompetitionsPage() {
  const { db } = await requireUser();
  const [input, tz] = await Promise.all([latestInput(db), userTimezone(db)]);
  const today = todayIn(tz);
  const { calendar, outlook, trend } = await outlookFor(db, today, input?.data.profile.weightKg ?? 80);
  const byId = new Map(outlook.comps.map((c) => [c.id, c]));
  const main = calendar.find((c) => c.isMain);

  const entries = calendar.map((c) => ({
    id: c.id,
    name: c.name,
    date: c.date,
    gi: c.gi,
    weighIn: c.weighInTiming,
    limitKg: c.targetWeightKg,
    matchMinutes: c.matchLenSec / 60,
    matches: c.matches,
    restMinutes: c.restMin,
    isMain: c.isMain,
    ...(byId.get(c.id) ? { outlook: byId.get(c.id)! } : {}),
  }));

  return (
    <>
      <div>
        <div className="eyebrow">Your season</div>
        <h2>Competitions</h2>
      </div>
      <CompetitionCalendar
        entries={entries}
        today={today}
        defaults={{
          name: "",
          date: today,
          gi: main?.gi ?? "gi",
          weighIn: main?.weighInTiming ?? "same_day",
          limitKg: main?.targetWeightKg ?? null,
          matchMinutes: main ? main.matchLenSec / 60 : 5,
          matches: main?.matches ?? 4,
          restMinutes: main?.restMin ?? 20,
        }}
      />
      <section className="panel" aria-labelledby="outlook-heading">
        <h3 id="outlook-heading">Weight outlook</h3>
        {outlook.comps.some((c) => c.limitKg != null) ? (
          <OutlookList comps={outlook.comps.filter((c) => c.limitKg != null)} drivingId={outlook.drivingId} />
        ) : (
          <p className="hint">Add a division limit to a competition to get a weight target and calories that work towards it.</p>
        )}
        <p className="hint">
          Trend weight {trend.trendKg} kg. Your plan peaks for your <b>main</b> competition. Every competition with a limit counts towards your calories: the one that needs the fastest pace sets the daily deficit, within safe limits. Limits are ceilings: the app aims 0.5 kg under. It never plans water cuts, and the final week before a weigh-in is maintenance.
        </p>
      </section>
    </>
  );
}
