import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <ComingSoon title="Progress">
      Trends from your logs: easy-pace heart rate, final-round effort in comp sims, recovery between rounds, and
      weight against the plan.
    </ComingSoon>
  );
}
