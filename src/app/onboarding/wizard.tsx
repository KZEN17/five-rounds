"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormProvider, get, useForm, useFormContext, type FieldPath } from "react-hook-form";
import { rejectUnderage, submitOnboarding } from "@/actions/onboarding";
import { BELTS, EQUIPMENT, planInputSchema, STRENGTH_STYLES, WEEKDAYS, type PlanInput } from "@/lib/engine";

const STEPS = ["You", "Competition", "Fitness", "Training", "Equipment", "Strength", "Nutrition"] as const;
const SECTIONS = ["profile", "competition", "fitness", "availability", "equipment", "strength", "nutrition"] as const;
const SKIPPABLE = [false, false, true, false, true, true, true];

const EQUIPMENT_LABEL: Record<(typeof EQUIPMENT)[number], string> = {
  bike: "Stationary bike",
  rower: "Rower",
  assault_bike: "Assault / air bike",
  treadmill: "Treadmill",
  outdoor_run: "Outdoor running",
  pool: "Swimming pool",
  barbell: "Barbell gym",
  kettlebell: "Kettlebells",
  bands: "Bands",
  none: "Nothing",
};
const STYLE_LABEL: Record<(typeof STRENGTH_STYLES)[number], string> = {
  atg: "ATG / knees-over-toes",
  barbell: "Barbell",
  kettlebell: "Kettlebell",
  bodyweight: "Bodyweight",
  custom: "My own exercises",
};
const INJURIES = [
  ["knee", "Knee"],
  ["lowerBack", "Lower back"],
  ["neck", "Neck"],
  ["shoulder", "Shoulder"],
  ["ankle", "Ankle"],
  ["other", "Other"],
] as const;

const NOT_MEDICAL = "Five Rounds gives training and nutrition guidance, not medical advice. If you have an injury or a health condition, check with a professional.";

function Err({ name }: { name: FieldPath<PlanInput> }) {
  const { formState } = useFormContext<PlanInput>();
  const msg = (get(formState.errors, name) as { message?: string } | undefined)?.message;
  return msg ? <span className="text-xs font-medium tracking-normal text-bad normal-case">{msg}</span> : null;
}

function Num({ name, label, nullable, placeholder, step }: { name: FieldPath<PlanInput>; label: string; nullable?: boolean; placeholder?: string; step?: string }) {
  const { register } = useFormContext<PlanInput>();
  return (
    <label className="field">
      {label}
      <input
        type="number"
        inputMode="decimal"
        step={step ?? "any"}
        placeholder={placeholder}
        {...register(name, nullable ? { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) } : { valueAsNumber: true })}
      />
      <Err name={name} />
    </label>
  );
}

function Select({ name, label, options, numeric }: { name: FieldPath<PlanInput>; label: string; options: readonly (readonly [string | number, string])[]; numeric?: boolean }) {
  const { register } = useFormContext<PlanInput>();
  return (
    <label className="field">
      {label}
      <select {...register(name, numeric ? { setValueAs: (v) => (v === "" ? null : Number(v)) } : {})}>
        {options.map(([v, l]) => (
          <option key={String(v)} value={v}>
            {l}
          </option>
        ))}
      </select>
      <Err name={name} />
    </label>
  );
}

function Check({ name, label }: { name: FieldPath<PlanInput>; label: string }) {
  const { register } = useFormContext<PlanInput>();
  return (
    <label className="toggle">
      <input type="checkbox" {...register(name)} /> {label}
    </label>
  );
}

export function Wizard({ defaults, editing }: { defaults: PlanInput; editing: boolean }) {
  const form = useForm<PlanInput>({ resolver: zodResolver(planInputSchema), defaultValues: defaults, mode: "onTouched" });
  const [step, setStep] = useState(0);
  const [underage, setUnderage] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = form.handleSubmit(
    (input) =>
      start(async () => {
        setError("");
        const res = await submitOnboarding({ input, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        if (!res.ok) return setError(res.error);
        router.push("/plan");
        router.refresh();
      }),
    (errors) => {
      const first = SECTIONS.findIndex((s) => errors[s]);
      if (first >= 0) setStep(first);
      setError("Some answers need fixing.");
    },
  );

  async function next() {
    setError("");
    if (step === 0 && Number(form.getValues("profile.age")) < 18) return setUnderage(true);
    if (!(await form.trigger(SECTIONS[step]))) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else await submit();
  }

  function skip() {
    const section = SECTIONS[step]!;
    form.setValue(section, defaults[section] as never, { shouldValidate: true });
    setStep(step + 1);
  }

  if (underage) {
    return (
      <div className="panel" role="alert">
        <h2>Five Rounds is for adults</h2>
        <p>You need to be 18 or older to use Five Rounds, so we can&apos;t make a plan for you. If you mistyped your age, go back and fix it. Otherwise we&apos;ll delete your account now.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => setUnderage(false)}>
            I mistyped it
          </button>
          <button type="button" className="btn btn-primary" onClick={() => start(() => rejectUnderage())} disabled={pending}>
            Delete my account
          </button>
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void next();
        }}
      >
        <header className="flex flex-col gap-2">
          <div className="eyebrow">
            {editing ? "Update your plan" : "Set up your plan"} · step {step + 1} of {STEPS.length}
          </div>
          <h1>{STEPS[step]}</h1>
          <div className="flex gap-1" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-sunk"}`} />
            ))}
          </div>
        </header>

        <div className="panel">{[<You key="0" />, <Competition key="1" />, <Fitness key="2" />, <Training key="3" />, <Equipment key="4" />, <Strength key="5" />, <Nutrition key="6" />][step]}</div>

        {error ? (
          <p role="alert" className="flag flag-warn">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {step > 0 ? (
            <button type="button" className="btn" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : null}
          {SKIPPABLE[step] ? (
            <button type="button" className="btn" onClick={skip}>
              Skip, use defaults
            </button>
          ) : null}
          <button type="submit" className="btn btn-primary flex-1" disabled={pending}>
            {step < STEPS.length - 1 ? "Next" : pending ? "Building your plan…" : editing ? "Regenerate my plan" : "Build my plan"}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}

function You() {
  return (
    <>
      <p className="hint">{NOT_MEDICAL}</p>
      <div className="grid grid-cols-2 items-end gap-3">
        <Num name="profile.age" label="Age" step="1" />
        <Select name="profile.sex" label="Sex" options={[["male", "Male"], ["female", "Female"]]} />
        <Num name="profile.heightCm" label="Height (cm)" />
        <Num name="profile.weightKg" label="Weight (kg)" />
        <Select name="profile.belt" label="Belt" options={BELTS.map((b) => [b, b[0]!.toUpperCase() + b.slice(1)] as const)} />
        <Num name="profile.yearsTraining" label="Years training" />
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="field mb-1">Injuries or limitations</legend>
        <div className="grid grid-cols-2 gap-x-3">
          {INJURIES.map(([key, label]) => (
            <Check key={key} name={`profile.injuries.${key}`} label={label} />
          ))}
        </div>
      </fieldset>
      <TextArea name="profile.injuries.notes" label="Anything else about injuries" placeholder="e.g. old ACL repair, left knee" />
    </>
  );
}

function TextArea({ name, label, placeholder }: { name: FieldPath<PlanInput>; label: string; placeholder?: string }) {
  const { register } = useFormContext<PlanInput>();
  return (
    <label className="field">
      {label}
      <textarea rows={2} placeholder={placeholder} {...register(name)} />
      <Err name={name} />
    </label>
  );
}

function Competition() {
  const { register, watch } = useFormContext<PlanInput>();
  const test = watch("competition.kind") === "test";
  return (
    <>
      <fieldset className="seg">
        <legend className="sr-only">Competition or test</legend>
        {(["competition", "test"] as const).map((k) => (
          <label key={k} className={`grid min-h-10 flex-1 cursor-pointer place-items-center rounded-lg text-[13px] font-semibold ${watch("competition.kind") === k ? "bg-surface text-fg shadow-sm" : "text-muted"}`}>
            <input type="radio" value={k} className="sr-only" {...register("competition.kind")} />
            {k === "competition" ? "I have a competition" : "No competition yet"}
          </label>
        ))}
      </fieldset>
      {test ? <p className="hint">Pick a date for a test instead: an in-house comp sim. The plan builds to that day.</p> : null}
      <label className="field">
        {test ? "Name (optional)" : "Competition name"}
        <input {...register("competition.name")} placeholder={test ? "Test day" : "e.g. Spring Open"} />
      </label>
      <label className="field">
        {test ? "Test date" : "Date"}
        <input type="date" {...register("competition.date")} />
        <Err name="competition.date" />
      </label>
      <Select
        name="competition.weighIn"
        label="Weigh-in"
        options={[["same_day", "Right before first match"], ["day_before", "Day before"], ["unsure", "Not sure"]]}
      />
      <div className="grid grid-cols-2 items-end gap-3">
        <Num name="competition.targetWeightKg" label="Division limit (kg)" nullable placeholder="optional" />
        <Select name="competition.gi" label="Format" options={[["gi", "Gi"], ["nogi", "No-gi"]]} />
        <Num name="competition.matchMinutes" label="Match length (min)" />
        <Num name="competition.matches" label="Matches in a day" step="1" />
        <Num name="competition.restMinutes" label="Rest between (min)" />
      </div>
    </>
  );
}

function Fitness() {
  const { watch, setValue } = useFormContext<PlanInput>();
  const secs = watch("fitness.row2kSeconds");
  const [row, setRow] = useState(secs ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : "");
  return (
    <>
      <Select
        name="fitness.baselineRounds"
        label="How many hard 5-minute rounds with 1-minute rest before you're in survival mode?"
        numeric
        options={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => [n, String(n)] as const)}
      />
      <div className="grid grid-cols-2 items-end gap-3">
        <Num name="fitness.restingHr" label="Resting HR (bpm)" nullable placeholder="optional" step="1" />
        <Num name="fitness.sleepHours" label="Average sleep (h)" nullable placeholder="optional" />
        <Num name="fitness.hrv" label="HRV (ms)" nullable placeholder="optional" />
        <Num name="fitness.bike20AvgHr" label="20-min bike avg HR, RPE 3–4" nullable placeholder="optional" step="1" />
        <label className="field">
          2 km row time
          <input
            inputMode="numeric"
            placeholder="m:ss, optional"
            value={row}
            onChange={(e) => {
              setRow(e.target.value);
              const m = /^(\d{1,2}):([0-5]\d)$/.exec(e.target.value.trim());
              setValue("fitness.row2kSeconds", m ? Number(m[1]) * 60 + Number(m[2]) : null, { shouldValidate: true });
            }}
          />
          <Err name="fitness.row2kSeconds" />
        </label>
      </div>
    </>
  );
}

function Training() {
  const { watch, setValue } = useFormContext<PlanInput>();
  const bjj = watch("availability.bjj");
  const setDay = (day: number, v: "off" | "technical" | "hard") => {
    const rest = bjj.filter((c) => c.day !== day);
    setValue("availability.bjj", v === "off" ? rest : [...rest, { day, intensity: v }].sort((a, b) => a.day - b.day), { shouldDirty: true });
  };
  return (
    <>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="field mb-1">BJJ classes each week</legend>
        {WEEKDAYS.map((label, day) => {
          const cur = bjj.find((c) => c.day === day)?.intensity ?? "off";
          return (
            <div key={label} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
              <span className="font-display text-lg font-bold uppercase">{label}</span>
              <div className="seg" role="group" aria-label={`${label} class`}>
                {(["off", "technical", "hard"] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={cur === v} onClick={() => setDay(day, v)}>
                    {v === "off" ? "None" : v === "hard" ? "Hard" : "Technical"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </fieldset>
      <div className="grid grid-cols-2 items-end gap-3">
        <Select name="availability.openMatDay" label="Open mat day" numeric options={[["", "None"], ...WEEKDAYS.map((d, i) => [i, d] as const)]} />
        <Select name="availability.extraSessions" label="Extra conditioning sessions / week" numeric options={[1, 2, 3, 4].map((n) => [n, String(n)] as const)} />
        <Num name="availability.extraMinutes" label="Max minutes per extra session" step="5" />
        <Select
          name="availability.preferredTime"
          label="Preferred time"
          options={[["any", "Any time"], ["morning", "Morning"], ["midday", "Midday"], ["evening", "Evening"]]}
        />
      </div>
    </>
  );
}

function Equipment() {
  const { register } = useFormContext<PlanInput>();
  return (
    <fieldset className="grid grid-cols-2 gap-x-3">
      <legend className="hint mb-2">What can you use for conditioning and strength?</legend>
      {EQUIPMENT.map((e) => (
        <label key={e} className="toggle">
          <input type="checkbox" value={e} {...register("equipment")} /> {EQUIPMENT_LABEL[e]}
        </label>
      ))}
    </fieldset>
  );
}

function Strength() {
  const { register, watch, setValue } = useFormContext<PlanInput>();
  const custom = watch("strength.style") === "custom";
  const exercises = watch("strength.customExercises");
  return (
    <>
      <fieldset className="flex flex-col">
        <legend className="field mb-1">Style</legend>
        {STRENGTH_STYLES.map((s) => (
          <label key={s} className="toggle">
            <input type="radio" value={s} {...register("strength.style")} /> {STYLE_LABEL[s]}
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-2 items-end gap-3">
        <Select name="strength.daysPerWeek" label="Days per week" numeric options={[0, 1, 2, 3].map((n) => [n, String(n)] as const)} />
        <Num name="strength.sessionMinutes" label="Session length (min)" step="5" />
      </div>
      {custom ? (
        <label className="field">
          Your exercises, one per line
          <textarea
            rows={4}
            defaultValue={exercises.join("\n")}
            onChange={(e) =>
              setValue(
                "strength.customExercises",
                e.target.value.split("\n").map((l) => l.trim()).filter(Boolean),
                { shouldValidate: true },
              )
            }
          />
          <Err name="strength.customExercises" />
        </label>
      ) : null}
    </>
  );
}

function Nutrition() {
  return (
    <>
      <Select
        name="nutrition.activityFactor"
        label="Daily life outside training"
        numeric
        options={[[1.2, "Desk job ×1.2"], [1.375, "Some walking ×1.375"], [1.5, "On your feet ×1.5"]]}
      />
      <Select name="nutrition.proteinGPerKg" label="Protein (g per kg)" numeric options={[1.6, 1.8, 2, 2.2].map((n) => [n, String(n)] as const)} />
      <Check name="nutrition.protectHardDays" label="Protect hard days (half the deficit on hard days, the rest on easy days)" />
      <TextArea name="nutrition.dietaryNotes" label="Dietary notes" placeholder="e.g. vegetarian. Only used to filter meal suggestions." />
      <p className="hint">{NOT_MEDICAL}</p>
    </>
  );
}
