import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <ComingSoon title="Today">
      Your readiness check-in, today&apos;s sessions with quick logging, and today&apos;s fuel summary will live here
      once you&apos;ve set up your plan.
    </ComingSoon>
  );
}
