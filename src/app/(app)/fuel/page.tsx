import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Fuel" };

export default function FuelPage() {
  return (
    <ComingSoon title="Fuel">
      Daily calorie and macro targets built from your training, a food log with a meal builder, and your weigh-ins.
    </ComingSoon>
  );
}
