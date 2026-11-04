import type { ExerciseLog, MealItem, RoundLog, SessionParams } from "@/lib/db/schema";
import { addDays, type IsoDate, type SessionType, type TimeOfDay } from "@/lib/engine";

/** The original app's state blob (its `S` object). Values were stored as typed text. */
type Text = string | number | null | undefined;
type LegacyItem = { id: string; type: string; mins?: Text; rounds?: Text; when?: string; title?: string };
type LegacyRound = { rpe?: Text; gas?: string; end?: Text; rec?: Text; m?: Text };
type LegacyLog = { done?: boolean; dur?: Text; rpe?: Text; rolls?: Text; avg?: Text; max?: Text; notes?: string; rounds?: (LegacyRound | null)[] };
type LegacyFood = { id?: string; name?: string; kcal?: Text; p?: Text; c?: Text; f?: Text; ing?: string };
export type LegacyState = {
  start: string;
  sat?: Record<string, string>;
  logs?: Record<string, LegacyLog>;
  weeks?: Record<string, boolean>;
  ready?: Record<string, { sleep?: Text; rhr?: Text; hrv?: Text }>;
  bikeCap?: Text;
  custom?: Record<string, LegacyItem[]>;
  fuel?: {
    sex?: string;
    age?: Text;
    height?: Text;
    weights?: Record<string, Text>;
    food?: Record<string, LegacyFood[]>;
    ingr?: Record<string, LegacyFood>;
    meals?: Record<string, { name: string; items: { name: string; kcal: Text; p: Text; c: Text; f: Text; g: Text }[]; serv?: Text }>;
  };
};

export function isLegacyState(x: unknown): x is LegacyState {
  return Boolean(x && typeof x === "object" && typeof (x as LegacyState).start === "string" && "logs" in (x as object));
}

const num = (v: Text): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const int = (v: Text) => (num(v) == null ? null : Math.round(num(v)!));

// The original app's 8-week programme (its BIKE, ROW, SIM arrays and planItems).
const BIKE = [[30, 30], [35, 30], [35, 35], [40, 35], [40, 40], [45, 40], [45, 45], [30, 30]];
const ROW = [3, 3, 4, 4, 5, 5, 5, 3];
const SIM = [3, 3, 4, 4, 4, 5, 5, 3];

function planItems(S: LegacyState, w: number, i: number): LegacyItem[] {
  const sat = S.sat?.[w] ?? (w % 2 ? "sim" : "row");
  const P = (type: string): LegacyItem => ({ id: "p", ...defaults(type, w, i) });
  if (i === 0 || i === 2 || i === 4) return [P("bjj")];
  if (i === 1 || i === 3) return [{ id: "atg", type: "atg" }, P("bike")];
  if (i === 5) return [P(sat)];
  return [{ id: "atg", type: "atg" }, P("walk")];
}

function defaults(type: string, w: number, i: number): Omit<LegacyItem, "id"> {
  if (type === "bike") return { type, mins: BIKE[w - 1]?.[i === 3 ? 1 : 0] };
  if (type === "row") return { type, rounds: ROW[w - 1] };
  if (type === "sim") return { type, rounds: SIM[w - 1] };
  return { type };
}

type Mapped = { type: SessionType; title: string; params: SessionParams };

function toSession(it: LegacyItem): Mapped {
  const rounds = int(it.rounds) ?? 3;
  const mins = int(it.mins) ?? 30;
  const base = { purpose: "", notes: "" };
  switch (it.type) {
    case "bjj":
      return { type: "bjj", title: "Hard BJJ", params: { ...base, minutes: 90, intensity: "hard", modality: "mat" } };
    case "open":
      return { type: "open_mat", title: "Open mat", params: { ...base, minutes: 90, intensity: "moderate", modality: "mat" } };
    case "sim":
      return { type: "comp_sim", title: `Comp sim ${rounds} × 5:00`, params: { ...base, rounds, workSec: 300, restSec: 60, intensity: "hard", modality: "mat" } };
    case "row":
      return { type: "intervals", title: `Rowing ${rounds} × 5:00`, params: { ...base, rounds, workSec: 300, restSec: 60, intensity: "hard", modality: "rower" } };
    case "bike":
      return { type: "aerobic", title: `Bike ${mins} min`, params: { ...base, minutes: mins, intensity: "easy", modality: "bike" } };
    case "atg":
      return { type: "mobility", title: "ATG", params: { ...base, minutes: 45, intensity: "easy", modality: "none", variant: "atg" } };
    case "walk":
      return { type: "walk", title: "Recovery walk", params: { ...base, minutes: 40, intensity: "easy", modality: "walk" } };
    case "strength":
      return { type: "strength", title: "Strength", params: { ...base, minutes: 60, intensity: "moderate", modality: "gym" } };
    default:
      return { type: "custom", title: it.title || "Custom session", params: { ...base, minutes: 60, intensity: "moderate", modality: "none" } };
  }
}

export type LegacyRows = ReturnType<typeof mapLegacy>;

/**
 * Turns the legacy blob into dated rows. Every row carries a stable external id, so
 * importing the same backup twice updates instead of duplicating.
 */
export function mapLegacy(S: LegacyState) {
  const dateOf = (w: number, i: number): IsoDate => addDays(S.start, (w - 1) * 7 + i);
  const sessions: (Mapped & { externalId: string; date: IsoDate; order: number; timeOfDay: TimeOfDay | null; source: "generated" | "user" })[] = [];
  const logs: {
    externalId: string;
    sessionExternalId: string | null;
    date: IsoDate;
    done: boolean;
    minutes: number | null;
    avgHr: number | null;
    maxHr: number | null;
    rpe: number | null;
    hardRounds: number | null;
    outputUnit: "m" | null;
    rounds: RoundLog[] | null;
    exercises: ExerciseLog[] | null;
    notes: string | null;
  }[] = [];
  const used = new Set<string>();

  const logFor = (key: string, sessionExternalId: string | null, date: IsoDate, isRow: boolean) => {
    const L = S.logs?.[key];
    if (!L) return;
    used.add(key);
    const rounds = (L.rounds ?? []).map((r) => ({
      rpe: num(r?.rpe),
      gas: (["Attacking", "Holding on", "Survival"].includes(r?.gas ?? "") ? r!.gas : null) as RoundLog["gas"],
      endHr: int(r?.end),
      recHr: int(r?.rec),
      output: num(r?.m),
    }));
    logs.push({
      externalId: `legacy:${key}`,
      sessionExternalId,
      date,
      done: Boolean(L.done),
      minutes: int(L.dur),
      avgHr: int(L.avg),
      maxHr: int(L.max),
      rpe: num(L.rpe),
      hardRounds: int(L.rolls),
      outputUnit: isRow ? "m" : null,
      rounds: rounds.length ? rounds : null,
      exercises: null,
      notes: L.notes?.trim() || null,
    });
  };

  for (let w = 1; w <= 8; w++) {
    for (let i = 0; i < 7; i++) {
      const dk = `w${w}d${i}`;
      const custom = S.custom?.[dk];
      const items = custom ?? planItems(S, w, i);
      items.forEach((it, order) => {
        const externalId = `legacy:${dk}:${it.id}`;
        const when = it.when?.toLowerCase();
        sessions.push({
          ...toSession(it),
          externalId,
          date: dateOf(w, i),
          order,
          timeOfDay: when === "morning" || when === "midday" || when === "evening" ? when : null,
          source: custom ? "user" : "generated",
        });
        logFor(it.id === "p" ? dk : `${dk}-${it.id}`, externalId, dateOf(w, i), it.type === "row");
      });
    }
  }
  // Logs whose session was later removed from the day: keep them on their date.
  for (const key of Object.keys(S.logs ?? {})) {
    if (used.has(key)) continue;
    const m = /^w(\d+)d(\d)/.exec(key);
    if (m) logFor(key, null, dateOf(Number(m[1]), Number(m[2])), false);
  }

  const weekMarks = Object.entries(S.weeks ?? {})
    .filter(([, done]) => done)
    .map(([w]) => ({ weekStart: addDays(S.start, (Number(w) - 1) * 7), done: true }));

  const readiness = Object.entries(S.ready ?? {}).map(([date, r]) => ({
    date,
    sleepH: num(r.sleep),
    rhr: int(r.rhr),
    hrv: num(r.hrv),
    soreness: null,
    mood: null,
  }));

  const weights = Object.entries(S.fuel?.weights ?? {}).flatMap(([date, kg]) => (num(kg) == null ? [] : [{ date, kg: num(kg)! }]));

  const foodLogs = Object.entries(S.fuel?.food ?? {}).flatMap(([date, list]) =>
    list.map((x, i) => ({
      externalId: `legacy:food:${date}:${x.id ?? i}`,
      date,
      name: x.name?.trim() || "Food",
      kcal: num(x.kcal) ?? 0,
      p: num(x.p),
      c: num(x.c),
      f: num(x.f),
      ingredients: x.ing ?? null,
    })),
  );

  const privateFoods = Object.values(S.fuel?.ingr ?? {}).flatMap((x) =>
    x.name ? [{ name: x.name.trim(), kcal: num(x.kcal) ?? 0, p: num(x.p) ?? 0, c: num(x.c) ?? 0, f: num(x.f) ?? 0 }] : [],
  );

  const meals = Object.values(S.fuel?.meals ?? {}).map((m) => ({
    name: m.name.trim(),
    portions: num(m.serv) ?? 1,
    items: m.items.map((x): MealItem => ({ name: x.name, kcal: num(x.kcal) ?? 0, p: num(x.p) ?? 0, c: num(x.c) ?? 0, f: num(x.f) ?? 0, g: num(x.g) ?? 0 })),
  }));

  const sex = S.fuel?.sex === "f" ? "female" : S.fuel?.sex === "m" ? "male" : null;
  const profile = {
    z2CeilingBpm: int(S.bikeCap),
    ...(sex ? { sex } : {}),
    ...(int(S.fuel?.age) != null ? { age: int(S.fuel?.age) } : {}),
    ...(num(S.fuel?.height) != null ? { heightCm: num(S.fuel?.height) } : {}),
  } as { z2CeilingBpm: number | null; sex?: "male" | "female"; age?: number | null; heightCm?: number | null };

  return { sessions, logs, weekMarks, readiness, weights, foodLogs, privateFoods, meals, profile };
}

export function countRows(rows: LegacyRows) {
  return {
    sessions: rows.sessions.length,
    logs: rows.logs.length,
    weekMarks: rows.weekMarks.length,
    readiness: rows.readiness.length,
    weights: rows.weights.length,
    foodLogs: rows.foodLogs.length,
    privateFoods: rows.privateFoods.length,
    meals: rows.meals.length,
  };
}
