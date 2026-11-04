import type { Metadata } from "next";
import Link from "next/link";
import { FoodPanel } from "@/components/fuel/food-panel";
import { WeightPanel } from "@/components/fuel/weight-panel";
import { LinkPending } from "@/components/spinner";
import { userTimezone } from "@/lib/actions";
import { fuelDay } from "@/lib/db/fuel-store";
import { latestInput } from "@/lib/db/plan-store";
import { addDays } from "@/lib/engine";
import { requireUser } from "@/lib/session";
import { longDate, shortDate, todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Fuel" };

const n0 = (v: number) => Math.round(v).toLocaleString("en-GB");

function Bar({ value, goal, tone }: { value: number; goal: number; tone: string }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-sunk">
      <i className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function FuelPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { db } = await requireUser();
  const [input, tz] = await Promise.all([latestInput(db), userTimezone(db)]);
  const today = todayIn(tz);
  const asked = (await searchParams).date;
  const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : today;
  if (!input) return null;
  const d = await fuelDay(db, date, input.data);
  const t = d.target;
  const left = t.target - d.eaten.kcal;
  const goalWarnings = d.outlook.warnings;
  const driving = d.outlook.comps.find((c) => c.id === d.outlook.drivingId);
  const adjustLabel = d.outlook.inFinalWeek
    ? `Final week before ${driving?.name || "your weigh-in"}: maintenance`
    : driving
      ? `Aiming for ${driving.aimKg} kg by ${driving.name || "your competition"} (${shortDate(driving.weighInDate)})`
      : "On weight: maintenance";

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2>Fuel</h2>
        <nav className="flex items-center gap-1" aria-label="Day">
          <Link href={`/fuel?date=${addDays(date, -1)}`} className="btn btn-small relative" aria-label="Previous day">
            ‹
            <LinkPending className="absolute -top-1 -left-1" />
          </Link>
          <span className="num min-w-28 text-center text-xl">{date === today ? "Today" : longDate(date)}</span>
          <Link href={`/fuel?date=${addDays(date, 1)}`} className="btn btn-small relative" aria-label="Next day">
            ›
            <LinkPending className="absolute -top-1 -right-1" />
          </Link>
        </nav>
      </div>

      <section className="panel" aria-label="Today's target">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">{left >= 0 ? "Left today" : "Over target"}</div>
            <div className={`num text-[58px] leading-[0.9] font-bold ${left < 0 ? "text-bad" : ""}`}>
              {n0(Math.abs(left))}
              <small className="text-lg font-medium text-muted"> kcal</small>
            </div>
          </div>
          <div className="text-right">
            <div className="eyebrow">Target</div>
            <div className="num text-[26px]">{n0(t.target)}</div>
            <div className="hint">{n0(d.eaten.kcal)} eaten</div>
          </div>
        </div>
        <Bar value={d.eaten.kcal} goal={t.target} tone={d.eaten.kcal > t.target ? "bg-bad" : "bg-accent"} />
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["Protein", d.eaten.p, t.proteinG],
              ["Carbs", d.eaten.c, t.carbsG],
              ["Fat", d.eaten.f, t.fatG],
            ] as const
          ).map(([label, eaten, goal]) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="text-xs text-muted">
                {label}{" "}
                <b className="text-fg">
                  {n0(eaten)}/{goal} g
                </b>
              </div>
              <Bar value={eaten} goal={goal} tone="bg-accent" />
            </div>
          ))}
        </div>
        {[...goalWarnings, ...t.warnings].map((w) => (
          <p key={w.code} className="flag flag-warn">
            {w.message}
          </p>
        ))}
        {d.finalWeek ? <p className="flag flag-warn">Final week: keep food and fluid normal. For any planned weight manipulation beyond this, work with a qualified sports dietitian.</p> : null}
        {t.hard ? (
          <p className="hint">
            <b>Hard day.</b> Put most of the {t.carbsG} g of carbs in the meal 2–3 hours before training and the one after.
          </p>
        ) : null}
      </section>

      <section className="panel" aria-labelledby="calc-heading">
        <h3 id="calc-heading">How the target is built</h3>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
          <dt>BMR at {d.weight.kg} kg</dt>
          <dd className="num text-right">{n0(t.bmr)}</dd>
          <dt>Daily life (×{input.data.nutrition.activityFactor})</dt>
          <dd className="num text-right">{n0(t.base)}</dd>
          {t.burns.length ? (
            t.burns.map((b, i) => (
              <div key={i} className="contents">
                <dt>{/\d+ min$/.test(b.title) && b.title.endsWith(`${Math.round(b.minutes)} min`) ? b.title : `${b.title} · ${Math.round(b.minutes)} min`}</dt>
                <dd className="num text-right">+{n0(b.kcal)}</dd>
              </div>
            ))
          ) : (
            <>
              <dt>No sessions planned</dt>
              <dd className="num text-right">+0</dd>
            </>
          )}
          <dt className="border-t border-line pt-1 font-semibold">Maintenance</dt>
          <dd className="num border-t border-line pt-1 text-right font-semibold">{n0(t.maintenance)}</dd>
          <dt>{adjustLabel}</dt>
          <dd className="num text-right">
            {t.adjustment < 0 ? "−" : t.adjustment > 0 ? "+" : ""}
            {n0(Math.abs(t.adjustment))}
          </dd>
          <dt className="border-t border-line pt-1 font-semibold">Target</dt>
          <dd className="num border-t border-line pt-1 text-right font-semibold">{n0(t.target)}</dd>
        </dl>
        <p className="hint">
          Session burn is an estimate. Logged minutes replace the planned ones.
          {input.data.nutrition.protectHardDays && d.outlook.dailyAdjustmentKcal < 0 ? " Hard days carry half the deficit; easy days carry the rest, so the week adds up the same." : ""}
          {" "}The deficit follows your weigh-ins and your{" "}
          <Link href="/competitions" className="underline">
            competition calendar
          </Link>
          .
        </p>
      </section>

      <FoodPanel date={date} isToday={date === today} logs={d.logs} recent={d.recent} foods={d.foods} meals={d.meals} />
      <WeightPanel
        key={date}
        date={date}
        isToday={date === today}
        kg={d.weight.kg}
        onDate={d.weight.onDate}
        series={d.weight.series}
        actualRate={d.weight.actualRate}
        targetRate={d.weight.targetRate}
      />
      <p className="hint">Five Rounds gives training and nutrition guidance, not medical advice. Targets are estimates: adjust them by how you train and how your weight moves.</p>
    </>
  );
}
