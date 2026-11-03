import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Timer" };

export default function TimerPage() {
  return (
    <ComingSoon title="Timer">
      A round timer set from your session: work, rest and rounds, with 3-2-1 beeps and the screen kept awake.
    </ComingSoon>
  );
}
