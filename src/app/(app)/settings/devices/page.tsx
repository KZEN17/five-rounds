import type { Metadata } from "next";
import { getProfile } from "@/lib/db/profile";
import { requireUser } from "@/lib/session";
import { DeviceForm } from "./device-form";

export const metadata: Metadata = { title: "Devices" };

const Path = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded bg-sunk px-1.5 py-0.5 font-mono text-[12px] text-fg">{children}</span>
);

export default async function DevicesPage() {
  const { db } = await requireUser();
  const profile = await getProfile(db);
  const device = profile?.device ?? "none";
  return (
    <>
      <h2>Devices</h2>
      <DeviceForm device={device} z2={profile?.z2CeilingBpm ?? null} />

      {device === "apple" ? (
        <section className="panel">
          <h3>Apple Watch: one-time setup</h3>
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            <li>
              <b>Check your heart-rate zones.</b> <Path>Watch app → Workout → Heart Rate Zones</Path>. Put the top of Zone 2 above: it&apos;s your ceiling for every easy session.
            </li>
            <li>
              <b>Build the easy aerobic workout.</b> <Path>Workout → Indoor Cycle (or Row) → ••• → Create Workout → Custom</Path>. Warm-up 5 min, one work block set by time, cool-down. Add a Zone 2 heart-rate alert.
            </li>
            <li>
              <b>Build the rounds.</b> <Path>Workout → Indoor Row → ••• → Create Workout → Custom</Path>. Work = your match length, Recovery 1:00, repeat for your rounds. Make one for each round count in your plan.
            </li>
          </ol>
        </section>
      ) : device === "garmin" ? (
        <section className="panel">
          <h3>Garmin: one-time setup</h3>
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            <li>
              <b>Check your heart-rate zones.</b> <Path>Garmin Connect → Settings → User Settings → Heart Rate Zones</Path>. Put the top of Zone 2 above.
            </li>
            <li>
              <b>Build the easy aerobic workout.</b> <Path>Garmin Connect → Training &amp; Planning → Workouts → Create</Path>. One step by time with a Zone 2 target, so the watch alerts you if you drift.
            </li>
            <li>
              <b>Build the rounds.</b> Same place: a repeat block with Run/Row work = your match length and Recover 1:00. Send it to the watch.
            </li>
          </ol>
        </section>
      ) : (
        <section className="panel">
          <h3>No watch</h3>
          <p>
            Use effort instead of heart rate. Easy aerobic work is RPE 3–4: you can hold a conversation and breathe through your nose. Use the Timer tab for rounds. Take your resting heart rate in the morning by counting your pulse for 30 seconds and doubling it.
          </p>
        </section>
      )}

      <section className="panel">
        <h3>After each session</h3>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>Open the workout on your phone: it shows average and max HR, and per-interval HR for rounds.</li>
          <li>Log it here: Plan or Today → the day → avg/max HR and RPE. On rounds days, add HR at the end of each round and at the end of each rest. The app works out your recovery and pacing.</li>
          <li>Each morning, enter sleep, resting HR and HRV on Today. After a few days you get a flag when you should ease off.</li>
        </ol>
      </section>
      <section className="panel">
        <h3>BJJ days</h3>
        <p className="hint">Leave the watch off on the mat. BJJ, open mat and comp sims are logged by effort: session RPE, hard rounds, and an RPE for every comp-sim round. Your morning resting HR and HRV show whether the mat work is being absorbed.</p>
      </section>
    </>
  );
}
