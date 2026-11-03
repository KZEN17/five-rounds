import { describe, expect, it } from "vitest";
import { adjustDay, readinessFlags, type ReadinessEntry } from "../readiness";
import type { Session } from "../types";

const history: ReadinessEntry[] = [1, 2, 3, 4, 5].map((d) => ({ date: `2026-01-0${d}`, sleepH: 8, rhr: 50, hrv: 80 }));

describe("readinessFlags", () => {
  it("flags short sleep, high resting HR and low HRV against the 7-day average", () => {
    const r = readinessFlags({ date: "2026-01-06", sleepH: 6.5, rhr: 55, hrv: 68 }, history, "2026-01-06");
    expect(r.flags.map((f) => f.code)).toEqual(["sleep", "rhr", "hrv"]);
  });

  it("gives a green light inside the thresholds", () => {
    const r = readinessFlags({ date: "2026-01-06", sleepH: 7, rhr: 54, hrv: 69 }, history, "2026-01-06");
    expect(r.flags).toEqual([]);
    expect(r.hasData).toBe(true);
  });

  it("needs 3 days of entries before comparing heart numbers", () => {
    const r = readinessFlags({ date: "2026-01-06", rhr: 70 }, history.slice(0, 2), "2026-01-06");
    expect(r.baseline.rhr).toBeNull();
    expect(r.flags).toEqual([]);
  });
});

const s = (type: Session["type"], extra: Partial<Session> = {}): Session => ({
  type,
  title: type,
  intensity: "hard",
  modality: "mat",
  purpose: "",
  notes: "",
  ...extra,
});

describe("adjustDay", () => {
  const flagged = { flags: [{ code: "sleep" as const, message: "6 h sleep" }] };

  it("suggests nothing on a green day", () => {
    expect(adjustDay({ date: "2026-01-06", sessions: [s("intervals")] }, { flags: [] }, { hardDaysLast3: 0 })).toEqual([]);
  });

  it("swaps intervals for mobility, comp sim for easy aerobic, hard BJJ for technical", () => {
    const out = adjustDay(
      { date: "2026-01-06", sessions: [s("bjj"), s("comp_sim"), s("intervals", { modality: "rower" }), s("aerobic", { intensity: "easy" })] },
      flagged,
      { hardDaysLast3: 0 },
      { easyModality: "bike" },
    );
    expect(out.map((x) => [x.index, x.to.type, x.to.intensity])).toEqual([
      [0, "bjj_technical", "moderate"],
      [1, "aerobic", "easy"],
      [2, "mobility", "easy"],
    ]);
    expect(out[0]!.reason).toContain("6 h sleep");
  });

  it("also swaps strength when the day is badly flagged or the last days were hard", () => {
    const day = { date: "2026-01-06", sessions: [s("strength", { intensity: "moderate" })] };
    expect(adjustDay(day, flagged, { hardDaysLast3: 0 })).toEqual([]);
    expect(adjustDay(day, flagged, { hardDaysLast3: 2 }).map((x) => x.to.type)).toEqual(["mobility"]);
  });
});
