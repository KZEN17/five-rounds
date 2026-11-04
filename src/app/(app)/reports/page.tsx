import type { Metadata } from "next";
import { ReportCard } from "@/components/reports/report-card";
import { listReports, markReportsRead } from "@/lib/db/report-store";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { db } = await requireUser();
  const rows = await listReports(db);
  await markReportsRead(db);
  return (
    <>
      <div>
        <div className="eyebrow">How it&apos;s going</div>
        <h2>Reports</h2>
      </div>
      <p className="hint">A short report every morning about the day before, and a recap every Monday. Turn on phone notifications or the weekly email in Settings → Notifications.</p>
      {rows.length ? rows.map((r) => <ReportCard key={r.id} report={r.payload} />) : <p className="hint">Your first report arrives the morning after your first full day on the plan.</p>}
    </>
  );
}
