import { pickModality } from "./conditioning";
import type { IsoDate } from "./dates";
import type { PlanInput } from "./input";
import * as S from "./sessions";
import { mobilitySession, strengthSession } from "./strength";
import type { Phase, Plan, Session, SessionType } from "./types";

export type TemplateContext = {
  rounds: number;
  workSec: number;
  restSec: number;
  aerobicMinutes: number;
  phase: Phase;
  input: PlanInput;
};

/** What a session of `type` looks like on a given day of this plan: used when swapping or adding. */
export function sessionTemplate(type: SessionType, ctx: TemplateContext): Session {
  const { input } = ctx;
  switch (type) {
    case "bjj":
      return S.bjj("hard");
    case "bjj_technical":
      return S.bjj("technical");
    case "open_mat":
      return S.openMat();
    case "comp_sim":
      return S.compSim(ctx.rounds, ctx.workSec, ctx.restSec, true);
    case "intervals":
      return S.intervals(pickModality("intervals", input.equipment, input.profile.injuries).modality, ctx.rounds, ctx.workSec, ctx.restSec, false);
    case "aerobic":
      return S.aerobic(pickModality("aerobic", input.equipment, input.profile.injuries).modality, ctx.aerobicMinutes);
    case "strength":
      return strengthSession(input.strength.style, ctx.phase === "taper" ? "peak" : ctx.phase, input.strength.sessionMinutes, input.strength.customExercises);
    case "mobility":
      return mobilitySession(input.strength.style);
    case "walk":
      return S.walk();
    case "competition":
      return S.competition(input);
    case "custom":
      return { type: "custom", title: "Custom session", minutes: 60, intensity: "moderate", modality: "none", purpose: "Your own session.", notes: "" };
  }
}

/** The plan's numbers around a date: that week's rounds, easy minutes and phase. */
export function contextFor(plan: Plan, input: PlanInput, date: IsoDate): TemplateContext {
  const week = plan.weeks.find((w) => w.days.some((d) => d.date === date)) ?? plan.weeks[0];
  const all = week?.days.flatMap((d) => d.sessions) ?? [];
  const hard = all.find((s) => (s.type === "comp_sim" || s.type === "intervals") && s.variant !== "threshold");
  const easy = all.find((s) => s.type === "aerobic");
  return {
    rounds: hard?.rounds ?? plan.rounds.start,
    workSec: plan.rounds.workSec,
    restSec: plan.rounds.restSec,
    aerobicMinutes: easy?.minutes ?? 30,
    phase: week?.phase ?? "general",
    input,
  };
}
