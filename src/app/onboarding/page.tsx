import type { Metadata } from "next";
import { latestInput } from "@/lib/db/plan-store";
import { profiles } from "@/lib/db/schema";
import { defaultPlanInput } from "@/lib/engine";
import { requireUser } from "@/lib/session";
import { todayIn } from "@/lib/time";
import { Wizard } from "./wizard";

export const metadata: Metadata = { title: "Your plan", robots: { index: false } };

export default async function OnboardingPage() {
  const { db } = await requireUser();
  const [latest, [profile]] = await Promise.all([latestInput(db), db.select(profiles).limit(1)]);
  const defaults = latest?.data ?? defaultPlanInput(todayIn(profile?.timezone ?? "UTC"));
  return (
    <main className="mx-auto flex max-w-140 flex-col gap-4 py-8">
      <Wizard defaults={defaults} editing={Boolean(latest)} />
    </main>
  );
}
