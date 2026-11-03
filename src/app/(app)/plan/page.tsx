import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Plan" };

export default function PlanPage() {
  return (
    <ComingSoon title="Plan">
      Your week-by-week plan to competition day: phases, sessions you can swap and edit, and a countdown.
    </ComingSoon>
  );
}
