import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Plan, PlanInput, Session, SessionType } from "@/lib/engine";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ---------- Better Auth tables (JS keys must match Better Auth's field names) ---------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* ---------- App tables ---------- */

/** Emails allowed to create an account when SIGNUP_MODE=invite. Stored lower-case. */
export const invites = pgTable("invites", {
  email: text("email").primaryKey(),
  createdAt: createdAt(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export type Injuries = {
  knee: boolean;
  lowerBack: boolean;
  neck: boolean;
  shoulder: boolean;
  ankle: boolean;
  other: boolean;
  notes: string;
};

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  age: integer("age"),
  sex: text("sex", { enum: ["male", "female"] }),
  heightCm: real("height_cm"),
  belt: text("belt", { enum: ["white", "blue", "purple", "brown", "black"] }),
  yearsTraining: real("years_training"),
  injuries: jsonb("injuries").$type<Injuries>(),
  units: text("units", { enum: ["metric"] }).notNull().default("metric"),
  timezone: text("timezone").notNull().default("UTC"),
  z2CeilingBpm: integer("z2_ceiling_bpm"),
  device: text("device", { enum: ["apple", "garmin", "none"] }).notNull().default("none"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ---------- Plans and training ---------- */

const userRef = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });
const day = (name: string) => date(name, { mode: "string" });

/** The athlete's competition calendar. One is the main competition the training plan peaks for. */
export const competitions = pgTable(
  "competitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    name: text("name").notNull().default(""),
    date: day("date").notNull(),
    gi: text("gi", { enum: ["gi", "nogi"] }).notNull(),
    weighInTiming: text("weigh_in_timing", { enum: ["same_day", "day_before", "unsure"] }).notNull(),
    /** Division limit: a ceiling to be at or under at weigh-in. */
    targetWeightKg: real("target_weight_kg"),
    matchLenSec: integer("match_len_sec").notNull(),
    matches: integer("matches").notNull(),
    restMin: real("rest_min").notNull(),
    isTest: boolean("is_test").notNull().default(false),
    isMain: boolean("is_main").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("competitions_user_date").on(t.userId, t.date),
    uniqueIndex("competitions_one_main").on(t.userId).where(sql`${t.isMain}`),
  ],
);

/** Every set of onboarding answers, versioned. Plans are generated from these. */
export const planInputs = pgTable(
  "plan_inputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    version: integer("version").notNull(),
    data: jsonb("data").$type<PlanInput>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("plan_inputs_user_version").on(t.userId, t.version), unique("plan_inputs_id_user").on(t.id, t.userId)],
);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    inputId: uuid("input_id").notNull(),
    version: integer("version").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    startDate: day("start_date").notNull(),
    compDate: day("comp_date").notNull(),
    active: boolean("active").notNull().default(true),
    /** The engine's full output: what "reset day" restores from. */
    output: jsonb("output").$type<Plan>().notNull(),
  },
  (t) => [
    unique("plans_id_user").on(t.id, t.userId),
    foreignKey({ columns: [t.inputId, t.userId], foreignColumns: [planInputs.id, planInputs.userId] }).onDelete("cascade"),
    uniqueIndex("plans_one_active").on(t.userId).where(sql`${t.active}`),
  ],
);

export type SessionParams = Omit<Session, "type" | "title" | "timeOfDay">;

export const planSessions = pgTable(
  "plan_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    planId: uuid("plan_id"),
    date: day("date").notNull(),
    order: integer("order").notNull().default(0),
    type: text("type").$type<SessionType>().notNull(),
    title: text("title").notNull(),
    params: jsonb("params").$type<SessionParams>().notNull(),
    timeOfDay: text("time_of_day", { enum: ["morning", "midday", "evening"] }),
    source: text("source", { enum: ["generated", "user", "readiness_swap"] }).notNull().default("generated"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    externalId: text("external_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("plan_sessions_user_date").on(t.userId, t.date),
    unique("plan_sessions_id_user").on(t.id, t.userId),
    unique("plan_sessions_external").on(t.userId, t.externalId),
    foreignKey({ columns: [t.planId, t.userId], foreignColumns: [plans.id, plans.userId] }).onDelete("cascade"),
  ],
);

export type RoundLog = { rpe?: number | null; gas?: "Attacking" | "Holding on" | "Survival" | null; endHr?: number | null; recHr?: number | null; output?: number | null };
export type ExerciseLog = { name: string; done: boolean; detail?: string };

export const sessionLogs = pgTable(
  "session_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    sessionId: uuid("session_id"),
    date: day("date").notNull(),
    done: boolean("done").notNull().default(false),
    minutes: integer("minutes"),
    avgHr: integer("avg_hr"),
    maxHr: integer("max_hr"),
    rpe: real("rpe"),
    hardRounds: integer("hard_rounds"),
    outputUnit: text("output_unit", { enum: ["m", "cal"] }),
    rounds: jsonb("rounds").$type<RoundLog[]>(),
    exercises: jsonb("exercises").$type<ExerciseLog[]>(),
    notes: text("notes"),
    externalId: text("external_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("session_logs_user_date").on(t.userId, t.date),
    uniqueIndex("session_logs_one_per_session").on(t.sessionId),
    unique("session_logs_external").on(t.userId, t.externalId),
    // A log can only point at the same user's session.
    foreignKey({ columns: [t.sessionId, t.userId], foreignColumns: [planSessions.id, planSessions.userId] }).onDelete("cascade"),
  ],
);

/** The legacy "week completed" toggle, keyed by the week's Monday so it survives regenerating. */
export const weekMarks = pgTable(
  "week_marks",
  { userId: userRef(), weekStart: day("week_start").notNull(), done: boolean("done").notNull().default(false) },
  (t) => [primaryKey({ columns: [t.userId, t.weekStart] })],
);

export const readiness = pgTable(
  "readiness",
  {
    userId: userRef(),
    date: day("date").notNull(),
    sleepH: real("sleep_h"),
    rhr: integer("rhr"),
    hrv: real("hrv"),
    soreness: integer("soreness"),
    mood: integer("mood"),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

/** Every readiness suggestion the athlete applied or ignored. */
export const readinessAdjustments = pgTable(
  "readiness_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    date: day("date").notNull(),
    sessionId: uuid("session_id"),
    action: text("action", { enum: ["applied", "ignored"] }).notNull(),
    reasons: jsonb("reasons").$type<string[]>().notNull(),
    before: jsonb("before").$type<Session | null>(),
    after: jsonb("after").$type<Session | null>(),
    createdAt: createdAt(),
  },
  (t) => [index("readiness_adjustments_user_date").on(t.userId, t.date)],
);

/* ---------- Weight and food ---------- */

export const weights = pgTable(
  "weights",
  { userId: userRef(), date: day("date").notNull(), kg: real("kg").notNull(), updatedAt: updatedAt() },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

/** Values per 100 g. `ownerId` null = the shared database; otherwise a user's private food. */
export const foods = pgTable(
  "foods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kcal: real("kcal").notNull(),
    p: real("p").notNull(),
    c: real("c").notNull(),
    f: real("f").notNull(),
    category: text("category").notNull().default("Other"),
    needsReview: boolean("needs_review").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("foods_global_name").on(sql`lower(${t.name})`).where(sql`${t.ownerId} is null`),
    uniqueIndex("foods_owner_name").on(t.ownerId, sql`lower(${t.name})`).where(sql`${t.ownerId} is not null`),
  ],
);

export type MealItem = { name: string; kcal: number; p: number; c: number; f: number; g: number };

export const meals = pgTable(
  "meals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    name: text("name").notNull(),
    items: jsonb("items").$type<MealItem[]>().notNull(),
    portions: real("portions").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("meals_user_name").on(t.userId, sql`lower(${t.name})`)],
);

export const foodLogs = pgTable(
  "food_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    date: day("date").notNull(),
    name: text("name").notNull(),
    kcal: real("kcal").notNull().default(0),
    p: real("p"),
    c: real("c"),
    f: real("f"),
    /** Short text like "Chicken 150g, Rice 80g · 1 of 2 portions". */
    ingredients: text("ingredients"),
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [index("food_logs_user_date").on(t.userId, t.date), unique("food_logs_external").on(t.userId, t.externalId)],
);
