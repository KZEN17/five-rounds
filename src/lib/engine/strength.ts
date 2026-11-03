import type { StrengthStyle } from "./input";
import type { Exercise, Phase, Session } from "./types";

type Block = "general" | "specific" | "peak" | "primer";

const e = (name: string, prescription: string, notes?: string): Exercise => (notes ? { name, prescription, notes } : { name, prescription });

/** Exercise library by style and phase. Users can swap any exercise inside a session. */
export const TEMPLATES: Record<Exclude<StrengthStyle, "custom">, Record<Block, Exercise[]>> = {
  atg: {
    general: [
      e("Tibialis raises", "2 × 20"),
      e("ATG split squat", "3 × 6 / side", "Knee past toes, slow down, pause at the bottom."),
      e("Nordic hamstring curl", "3 × 5", "Use a band or partner for assistance as needed."),
      e("Jefferson curl", "2 × 8", "Light. Slow, one vertebra at a time."),
      e("Backwards sled or walk", "5 min"),
      e("Copenhagen plank", "3 × 20 s / side"),
      e("Poliquin step-up", "2 × 15 / side"),
      e("Pull-ups or dead hangs", "3 × max / 30 s"),
    ],
    specific: [
      e("ATG split squat", "3 × 5 / side", "Loaded. Drive up fast."),
      e("Nordic hamstring curl", "3 × 4"),
      e("Copenhagen plank", "3 × 25 s / side"),
      e("Poliquin step-up", "2 × 12 / side"),
      e("Pull-ups", "3 × 5", "Add load if 5 is easy."),
      e("Tibialis raises", "2 × 15"),
    ],
    peak: [
      e("ATG split squat", "2 × 5 / side"),
      e("Nordic hamstring curl", "2 × 3"),
      e("Copenhagen plank", "2 × 20 s / side"),
      e("Pull-ups", "2 × 5"),
    ],
    primer: [
      e("Tibialis raises", "1 × 20"),
      e("ATG split squat", "2 × 5 / side", "Bodyweight only."),
      e("Dead hang", "2 × 20 s"),
    ],
  },
  barbell: {
    general: [
      e("Back squat", "4 × 5"),
      e("Romanian deadlift", "3 × 6"),
      e("Overhead or bench press", "4 × 5"),
      e("Barbell row", "4 × 6"),
      e("Pull-ups", "3 × 6"),
      e("Copenhagen plank", "2 × 20 s / side"),
    ],
    specific: [
      e("Back squat", "3 × 3", "Fast out of the hole."),
      e("Trap-bar deadlift", "3 × 4"),
      e("Push press", "3 × 3"),
      e("Barbell row", "3 × 5"),
      e("Jump squat", "3 × 3", "Light. Maximum intent."),
    ],
    peak: [
      e("Back squat", "2 × 2", "Moderate load, crisp reps."),
      e("Romanian deadlift", "2 × 3"),
      e("Overhead press", "2 × 3"),
      e("Pull-ups", "2 × 5"),
    ],
    primer: [e("Back squat", "2 × 2", "Light."), e("Box jump", "2 × 3"), e("Mobility flow", "10 min")],
  },
  kettlebell: {
    general: [
      e("Goblet squat", "4 × 8"),
      e("Kettlebell swing", "5 × 15"),
      e("Single-arm press", "4 × 6 / side"),
      e("Single-arm row", "4 × 8 / side"),
      e("Turkish get-up", "3 × 2 / side"),
      e("Suitcase carry", "3 × 30 m / side"),
    ],
    specific: [
      e("Double kettlebell front squat", "4 × 5"),
      e("Heavy swing", "6 × 10"),
      e("Push press", "4 × 5 / side"),
      e("Gorilla row", "4 × 6 / side"),
      e("Turkish get-up", "2 × 2 / side"),
    ],
    peak: [
      e("Double kettlebell front squat", "2 × 5"),
      e("Kettlebell swing", "3 × 10"),
      e("Single-arm press", "2 × 5 / side"),
      e("Single-arm row", "2 × 6 / side"),
    ],
    primer: [e("Kettlebell swing", "2 × 10", "Light."), e("Goblet squat", "2 × 5")],
  },
  bodyweight: {
    general: [
      e("Split squat", "3 × 10 / side"),
      e("Push-ups", "4 × 12"),
      e("Pull-ups or inverted rows", "4 × 8"),
      e("Nordic hamstring curl", "3 × 5", "Assisted as needed."),
      e("Hollow hold", "3 × 30 s"),
      e("Copenhagen plank", "3 × 20 s / side"),
    ],
    specific: [
      e("Jump squat", "4 × 5"),
      e("Plyo push-ups", "4 × 5"),
      e("Pull-ups", "4 × 5"),
      e("Pistol squat progression", "3 × 5 / side"),
      e("Bear crawl", "3 × 20 m"),
    ],
    peak: [e("Jump squat", "2 × 5"), e("Push-ups", "2 × 10"), e("Pull-ups", "2 × 5")],
    primer: [e("Jump squat", "2 × 3"), e("Push-ups", "1 × 10"), e("Mobility flow", "10 min")],
  },
};

function block(phase: Phase): Block {
  if (phase === "base" || phase === "general") return "general";
  if (phase === "specific") return "specific";
  if (phase === "peak") return "peak";
  return "primer";
}

const STYLE_NAME: Record<StrengthStyle, string> = {
  atg: "ATG",
  barbell: "Barbell",
  kettlebell: "Kettlebell",
  bodyweight: "Bodyweight",
  custom: "Your exercises",
};

export function strengthSession(
  style: StrengthStyle,
  phase: Phase,
  minutes: number,
  customExercises: readonly string[],
  opts: { primer?: boolean; deload?: boolean } = {},
): Session {
  const which = opts.primer ? "primer" : block(phase);
  const exercises =
    style === "custom"
      ? customExercises.map((name) => e(name, "As you planned"))
      : TEMPLATES[style][which].map((x) => ({ ...x }));
  const short = which === "peak" || which === "primer";
  return {
    type: "strength",
    title: opts.primer ? `Primer (${STYLE_NAME[style]})` : `Strength (${STYLE_NAME[style]})`,
    minutes: short ? Math.min(minutes, 30) : minutes,
    intensity: which === "primer" ? "easy" : "moderate",
    modality: style === "atg" || style === "bodyweight" ? "none" : "gym",
    purpose: opts.primer ? "Wake the legs up. Nothing heavy, nothing new." : "Strength and robustness for the mat.",
    notes: opts.deload
      ? "Deload week: same exercises, leave 3+ reps in reserve, no new maxes."
      : which === "peak"
        ? "Short and sharp. Moderate load, no grinding reps."
        : "Leave 1–2 reps in reserve. Quality over load.",
    ...(style === "atg" ? { variant: "atg" as const } : {}),
    ...(opts.primer ? { variant: "primer" as const } : {}),
    exercises,
  };
}

export function mobilitySession(style: StrengthStyle): Session {
  return {
    type: "mobility",
    title: style === "atg" ? "ATG mobility" : "Mobility",
    minutes: 20,
    intensity: "easy",
    modality: "none",
    purpose: "Mobility and tissue prep.",
    notes: "Hips, ankles, thoracic spine. Easy and unhurried.",
    ...(style === "atg" ? { variant: "atg" as const } : {}),
  };
}
