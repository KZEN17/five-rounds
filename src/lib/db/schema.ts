import { boolean, index, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

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
