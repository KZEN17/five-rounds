import { MODALITY_NAME } from "./conditioning";
import type { PlanInput } from "./input";
import type { Modality, Session } from "./types";

export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/** Planned length of a rounds session: work + rests + a warm-up/cool-down allowance. */
export const roundsMinutes = (rounds: number, workSec: number, restSec: number, warmup: number) =>
  Math.ceil((rounds * workSec + (rounds - 1) * restSec) / 60) + warmup;

export function bjj(intensity: "hard" | "technical"): Session {
  return intensity === "hard"
    ? {
        type: "bjj",
        title: "Hard BJJ",
        minutes: 90,
        intensity: "hard",
        modality: "mat",
        purpose: "Hard class: the main training stimulus.",
        notes: "Log minutes, session RPE and hard rounds.",
        timeOfDay: "evening",
      }
    : {
        type: "bjj_technical",
        title: "Technical BJJ",
        minutes: 75,
        intensity: "moderate",
        modality: "mat",
        purpose: "Technique and positional work.",
        notes: "Keep it flowing. Easy aerobic work can follow.",
        timeOfDay: "evening",
      };
}

export function dayBeforeComp(): Session {
  return { ...bjj("technical"), title: "Light drilling (optional)", minutes: 45, intensity: "easy", notes: "Day before competition: drill lightly or rest. Nothing new." };
}

export function openMat(): Session {
  return {
    type: "open_mat",
    title: "Open mat",
    minutes: 90,
    intensity: "moderate",
    modality: "mat",
    purpose: "Normal rolling.",
    notes: "No extra conditioning on top.",
  };
}

export function compSim(rounds: number, workSec: number, restSec: number, atOpenMat: boolean): Session {
  return {
    type: "comp_sim",
    title: `Comp sim ${rounds} × ${mmss(workSec)}`,
    minutes: roundsMinutes(rounds, workSec, restSec, 20),
    rounds,
    workSec,
    restSec,
    intensity: "hard",
    modality: "mat",
    purpose: "Match-specific: full rounds at match length.",
    notes: `${rounds} × ${mmss(workSec)} rounds, ${mmss(restSec)} rest, different partners${atOpenMat ? " at open mat" : ". Book a partner or two"}. Rate each round straight after the buzzer. Round ${rounds} shouldn't feel much harder than round 1.`,
  };
}

export function intervals(modality: Modality, rounds: number, workSec: number, restSec: number, replacesOpenMat: boolean): Session {
  const name = modality === "none" ? "Bodyweight rounds" : MODALITY_NAME[modality];
  return {
    type: "intervals",
    title: `${name} ${rounds} × ${mmss(workSec)}`,
    minutes: roundsMinutes(rounds, workSec, restSec, 15),
    rounds,
    workSec,
    restSec,
    intensity: "hard",
    modality,
    purpose: "Repeatable hard efforts at match length.",
    notes:
      (modality === "none"
        ? `${rounds} × ${mmss(workSec)}: sprawls, shots, burpees and shadow wrestling, ${mmss(restSec)} rest. `
        : `${rounds} × ${mmss(workSec)} work, ${mmss(restSec)} rest. RPE 7–8, even output. Note your HR at the end of each round and again after the rest. `) +
      (replacesOpenMat ? "Instead of open mat this week." : ""),
  };
}

export function threshold(modality: Modality, rounds: number): Session {
  const name = modality === "none" ? "bodyweight" : MODALITY_NAME[modality].toLowerCase();
  return {
    type: "intervals",
    title: `Threshold ${name} ${rounds} × 4:00`,
    minutes: roundsMinutes(rounds, 240, 120, 15),
    rounds,
    workSec: 240,
    restSec: 120,
    intensity: "hard",
    modality,
    variant: "threshold",
    purpose: "Raise the ceiling: hard but sustainable.",
    notes: `${rounds} × 4:00 at RPE 7, 2:00 easy between. Hard but steady: the last rep should match the first.`,
  };
}

export function aerobic(modality: Modality, minutes: number): Session {
  return {
    type: "aerobic",
    title: `${MODALITY_NAME[modality]} ${minutes} min`,
    minutes,
    intensity: "easy",
    modality,
    purpose: "Zone 2: RPE 3–4, conversational.",
    notes: "Nose-breathing pace. Stay under your Zone 2 heart-rate ceiling.",
  };
}

export function walk(): Session {
  return {
    type: "walk",
    title: "Recovery walk",
    minutes: 40,
    intensity: "easy",
    modality: "walk",
    purpose: "Recovery.",
    notes: "Easy. Check your sleep and resting HR.",
  };
}

export function competition(input: PlanInput): Session {
  const c = input.competition;
  return {
    type: "competition",
    title: c.kind === "test" ? c.name || "Test day (in-house comp sim)" : c.name || "Competition",
    minutes: Math.round(c.matches * c.matchMinutes + 30),
    rounds: c.matches,
    workSec: Math.round(c.matchMinutes * 60),
    intensity: "hard",
    modality: "mat",
    purpose: "The day you trained for.",
    notes:
      (c.weighIn === "same_day" ? "Be on weight walking in. " : "") +
      "Warm up properly, eat what you've practised, sip between matches.",
  };
}
