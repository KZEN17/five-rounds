import type { StrengthStyle } from "./input";
import type { Exercise, Phase, Session } from "./types";

type Block = "general" | "specific" | "peak" | "primer";

const e = (name: string, prescription: string, notes?: string): Exercise => (notes ? { name, prescription, notes } : { name, prescription });

/** Exercise library by style and phase. Users can swap any exercise inside a session. */
export const TEMPLATES: Record<Exclude<StrengthStyle, "custom" | "barbell">, Record<Block, Exercise[]>> = {
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

/** A structured gym lift: sets × reps with a load step for progression. */
const lift = (name: string, sets: number, reps: number, pattern: Exercise["pattern"], increment?: number, notes?: string): Exercise => ({
  name,
  prescription: `${sets} × ${reps}`,
  sets,
  reps,
  ...(pattern ? { pattern } : {}),
  ...(increment ? { increment } : {}),
  ...(notes ? { notes } : {}),
});

/**
 * Classic gym for grapplers: two full-body workouts, A and B, alternating. Heavier strength
 * early (3–5 × 3–6), more power and fewer reps in specific prep, a short moderate session at
 * peak, and only a light primer in the taper.
 */
export const GYM: Record<Block, [Exercise[], Exercise[]]> = {
  general: [
    [
      lift("Back squat", 4, 5, "squat", 5, "RPE 7–8: two or three reps left in the tank."),
      lift("Bench press", 4, 5, "push_h", 2.5),
      lift("Romanian deadlift", 3, 6, "hinge", 5),
      lift("Pull-ups", 3, 6, "pull_v", 2.5, "Add weight once 3 × 8 is easy."),
      // A timed hold: ticked off, not logged as kg × reps.
      { name: "Copenhagen plank", prescription: "2 × 20 s / side", pattern: "core" },
    ],
    [
      lift("Deadlift", 4, 4, "hinge", 5),
      lift("Overhead press", 4, 5, "push_v", 2.5),
      { ...lift("Bulgarian split squat", 3, 6, "single_leg", 2.5), prescription: "3 × 6 / side" },
      lift("Barbell row", 4, 6, "pull_h", 2.5),
      lift("Hanging knee raise", 3, 10, "core"),
    ],
  ],
  specific: [
    [
      lift("Back squat", 3, 3, "squat", 5, "Fast out of the hole."),
      lift("Bench press", 3, 3, "push_h", 2.5),
      lift("Box jump", 3, 3, "power", undefined, "Full recovery between jumps."),
      lift("Pull-ups", 3, 5, "pull_v", 2.5),
      { ...lift("Pallof press", 2, 10, "core"), prescription: "2 × 10 / side" },
    ],
    [
      lift("Deadlift", 3, 3, "hinge", 5),
      lift("Push press", 3, 3, "push_v", 2.5),
      lift("Barbell row", 3, 5, "pull_h", 2.5),
      { ...lift("Split squat", 2, 5, "single_leg", 2.5), prescription: "2 × 5 / side" },
      lift("Med-ball slam", 3, 5, "power"),
    ],
  ],
  peak: [
    [lift("Back squat", 2, 2, "squat", undefined, "Moderate load, crisp reps. Nothing heavy."), lift("Bench press", 2, 3, "push_h"), lift("Pull-ups", 2, 5, "pull_v")],
    [lift("Deadlift", 2, 2, "hinge", undefined, "Moderate load, crisp reps. Nothing heavy."), lift("Push press", 2, 2, "push_v"), lift("Barbell row", 2, 5, "pull_h")],
  ],
  primer: [
    [lift("Back squat", 2, 2, "squat", undefined, "Light."), lift("Box jump", 2, 3, "power"), lift("Push-ups", 1, 10, "push_h")],
    [lift("Back squat", 2, 2, "squat", undefined, "Light."), lift("Box jump", 2, 3, "power"), lift("Push-ups", 1, 10, "push_h")],
  ],
};

/** ATG prehab: knees, hips and back, on easy days next to gym training. */
const ATG_PREHAB: Exercise[] = [
  e("Tibialis raises", "2 × 20"),
  e("ATG split squat", "2 × 8 / side", "Bodyweight, slow, knee past toes."),
  e("Jefferson curl", "2 × 8", "Very light."),
  e("Copenhagen plank", "2 × 20 s / side"),
  e("Backwards walk", "3 min"),
];

const ATG_WARMUP: Exercise = {
  name: "ATG warm-up",
  prescription: "10 min",
  notes: "Tibialis raises, ATG split squats, Copenhagen plank.",
  pattern: "prehab",
};

function block(phase: Phase): Block {
  if (phase === "base" || phase === "general") return "general";
  if (phase === "specific") return "specific";
  if (phase === "peak") return "peak";
  return "primer";
}

const STYLE_NAME: Record<StrengthStyle, string> = {
  atg: "ATG",
  barbell: "Gym",
  kettlebell: "Kettlebell",
  bodyweight: "Bodyweight",
  custom: "Your exercises",
};

export function strengthSession(
  style: StrengthStyle,
  phase: Phase,
  minutes: number,
  customExercises: readonly string[],
  opts: { primer?: boolean; deload?: boolean; workout?: number; prehab?: "none" | "atg" } = {},
): Session {
  const which = opts.primer ? "primer" : block(phase);
  const ab = (opts.workout ?? 0) % 2;
  let exercises: Exercise[] =
    style === "custom"
      ? customExercises.map((name) => e(name, "As you planned"))
      : style === "barbell"
        ? GYM[which][ab]!.map((x) => ({ ...x }))
        : TEMPLATES[style][which].map((x) => ({ ...x }));
  if (opts.deload) {
    exercises = exercises.map((x) => (x.sets && x.sets > 1 ? { ...x, sets: x.sets - 1, prescription: x.prescription.replace(/^\d+/, String(x.sets - 1)) } : x));
  }
  if (opts.prehab === "atg" && style !== "atg" && !opts.primer) exercises = [{ ...ATG_WARMUP }, ...exercises];
  const short = which === "peak" || which === "primer";
  const label = style === "barbell" && !opts.primer ? `Gym ${ab === 0 ? "A" : "B"}` : `Strength (${STYLE_NAME[style]})`;
  return {
    type: "strength",
    title: opts.primer ? `Primer (${STYLE_NAME[style]})` : label,
    minutes: short ? Math.min(minutes, 30) : minutes,
    intensity: which === "primer" ? "easy" : "moderate",
    modality: style === "atg" || style === "bodyweight" ? "none" : "gym",
    purpose: opts.primer ? "Wake the legs up. Nothing heavy, nothing new." : "Strength and robustness for the mat.",
    notes: opts.deload
      ? "Deload week: one set fewer, leave 3+ reps in reserve, no new maxes."
      : which === "peak"
        ? "Short and sharp. Moderate load, no grinding reps."
        : "Leave 1–2 reps in reserve. Quality over load.",
    ...(style === "atg" ? { variant: "atg" as const } : {}),
    ...(opts.primer ? { variant: "primer" as const } : {}),
    exercises,
  };
}

/** Short ATG session for knees, hips and back, used alongside another main strength style. */
export function atgPrehabSession(): Session {
  return {
    type: "mobility",
    title: "ATG prehab",
    minutes: 20,
    intensity: "easy",
    modality: "none",
    purpose: "Knees, hips and back: keep the joints that grappling punishes robust.",
    notes: "Easy and controlled. Bodyweight or very light.",
    variant: "atg",
    exercises: ATG_PREHAB.map((x) => ({ ...x })),
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
