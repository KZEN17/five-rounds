import { and, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { RoundTimer, type TimerPreset } from "@/components/timer/round-timer";
import { activePlan } from "@/lib/db/plan-store";
import { planSessions } from "@/lib/db/schema";
import { contextFor, mmss } from "@/lib/engine";
import { userTimezone } from "@/lib/actions";
import { requireUser } from "@/lib/session";
import { todayIn } from "@/lib/time";
import { latestInput } from "@/lib/db/plan-store";

export const metadata: Metadata = { title: "Timer" };

export default async function TimerPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { db } = await requireUser();
  const { session: sessionId } = await searchParams;
  const [plan, input, tz] = await Promise.all([activePlan(db), latestInput(db), userTimezone(db)]);
  const today = todayIn(tz);
  const ctx = plan && input ? contextFor(plan.output, input.data, today) : null;
  const work = ctx?.workSec ?? 300;
  const rest = ctx?.restSec ?? 60;
  const rounds = ctx?.rounds ?? 5;

  const presets: TimerPreset[] = [
    { key: "rounds", label: `Rounds ${rounds}×${mmss(work)}`, kind: "rounds", rounds, workSec: work, restSec: rest },
    { key: "steady", label: `Easy ${ctx?.aerobicMinutes ?? 30} min`, kind: "steady", rounds: 1, workSec: (ctx?.aerobicMinutes ?? 30) * 60, restSec: 0 },
  ];
  let initial = "rounds";

  // Opened from a session: use its exact format.
  const uuid = /^[0-9a-f-]{36}$/i.test(sessionId ?? "") ? sessionId : undefined;
  if (uuid) {
    const [row] = await db.select(planSessions, and(eq(planSessions.id, uuid), isNull(planSessions.deletedAt))).limit(1);
    if (row?.params.rounds && row.params.workSec) {
      presets.unshift({
        key: "session",
        label: row.title,
        kind: "rounds",
        rounds: row.params.rounds,
        workSec: row.params.workSec,
        restSec: row.params.restSec ?? 60,
      });
      initial = "session";
    } else if (row?.params.minutes) {
      presets.unshift({ key: "session", label: row.title, kind: "steady", rounds: 1, workSec: row.params.minutes * 60, restSec: 0 });
      initial = "session";
    }
  }

  return (
    <>
      <h2>Timer</h2>
      <RoundTimer presets={presets} initial={initial} />
    </>
  );
}
