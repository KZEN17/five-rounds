"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCompetition, makeMainCompetition } from "@/actions/competitions";
import { Saving } from "@/components/spinner";
import { WEEKDAYS, weekdayOf, type CompOutlook } from "@/lib/engine";
import { CompetitionForm, type CompetitionValues } from "./competition-form";
import { StatusTag } from "./outlook-list";

const WEIGH_IN = { same_day: "weigh-in before first match", day_before: "weigh-in the day before", unsure: "weigh-in time unknown" } as const;

export function CompetitionCard({ values, isMain, outlook, past }: { values: Required<Pick<CompetitionValues, "id">> & CompetitionValues; isMain: boolean; outlook?: CompOutlook; past?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"view" | "edit" | "main" | "delete">("view");
  const [error, setError] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      setMode("view");
      router.refresh();
    });
  const day = Number(values.date.slice(8, 10));

  return (
    <li className="panel gap-2">
      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
        <div className="text-center font-display leading-none uppercase">
          <b className="block text-[28px]">{day}</b>
          <span className="font-body text-xs text-muted">{WEEKDAYS[weekdayOf(values.date)]}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <b className="text-lg">{values.name || "Competition"}</b>
            {isMain ? <span className="tag bg-accent text-accent-ink">Main</span> : null}
            {outlook && !past ? <StatusTag status={outlook.status} /> : null}
          </div>
          <p className="hint">
            {values.gi === "gi" ? "Gi" : "No-gi"} · {values.matches} × {values.matchMinutes} min · {WEIGH_IN[values.weighIn]}
            {values.limitKg != null ? ` · limit ${values.limitKg} kg` : ""}
          </p>
          {outlook && !past ? <p className="text-sm">{outlook.message}</p> : null}
        </div>
      </div>

      {mode === "edit" ? (
        <CompetitionForm initial={values} isMain={isMain} onDone={() => setMode("view")} />
      ) : mode === "main" ? (
        <div className="flex flex-col gap-2 rounded-[10px] bg-sunk p-3">
          <p>Make this your main competition? Your training plan is rebuilt to peak for it. Logged sessions and past days stay.</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => makeMainCompetition({ id: values.id }))}>
              Rebuild my plan
            </button>
            <button type="button" className="btn" onClick={() => setMode("view")}>
              Cancel
            </button>
          </div>
        </div>
      ) : mode === "delete" ? (
        <div className="flex flex-col gap-2 rounded-[10px] bg-sunk p-3">
          <p>Delete {values.name || "this competition"}?</p>
          <div className="flex gap-2">
            <button type="button" className="btn border-bad bg-bad text-white" disabled={pending} onClick={() => run(() => deleteCompetition({ id: values.id }))}>
              Delete
            </button>
            <button type="button" className="btn" onClick={() => setMode("view")}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-small" onClick={() => setMode("edit")}>
            Edit
          </button>
          {!isMain && !past ? (
            <button type="button" className="btn btn-small" onClick={() => setMode("main")}>
              Make main
            </button>
          ) : null}
          {!isMain ? (
            <button type="button" className="btn btn-small" onClick={() => setMode("delete")}>
              Delete
            </button>
          ) : null}
        </div>
      )}
      <Saving pending={pending} label={mode === "main" ? "Rebuilding your plan…" : "Saving…"} />
      {error ? (
        <p role="alert" className="flag flag-warn">
          {error}
        </p>
      ) : null}
    </li>
  );
}
