import type { Metadata } from "next";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Your data" };

export default function DataPage() {
  return (
    <>
      <h2>Your data</h2>
      <section className="panel" aria-labelledby="export-heading">
        <h3 id="export-heading">Export</h3>
        <p className="hint">Everything you&apos;ve entered (answers, plans, sessions, logs, readiness, food, meals, weights) as one JSON file. Keep it somewhere safe.</p>
        <a href="/api/export" className="btn btn-primary self-start" download>
          Download my data
        </a>
      </section>
      <ImportForm />
    </>
  );
}
