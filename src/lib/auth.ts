import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { eq } from "drizzle-orm";
import { getDb, type Database } from "@/lib/db/client";
import { account, invites, session, user, verification } from "@/lib/db/schema";
import { mailSenderFromEnv, type MailSender } from "@/lib/mail";
import { canCreateAccount, normalizeEmail, signupModeFrom, type SignupMode } from "@/lib/signup-policy";

export type AuthDeps = {
  db: Database;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  sendMail: MailSender;
  signupMode: SignupMode;
  ownerEmail?: string | undefined;
  google?: { clientId: string; clientSecret: string } | undefined;
  /** Next's cookie bridge for Server Actions. Off in unit tests, which run outside a request. */
  nextjs?: boolean;
};

const SIXTY_DAYS = 60 * 60 * 24 * 60;

export function createAuth(deps: AuthDeps) {
  const { db } = deps;

  async function mayCreateAccount(email: string): Promise<boolean> {
    const normalized = normalizeEmail(email);
    const invited =
      deps.signupMode === "invite" &&
      (await db.select({ email: invites.email }).from(invites).where(eq(invites.email, normalized)).limit(1))
        .length > 0;
    return canCreateAccount({ email: normalized, mode: deps.signupMode, ownerEmail: deps.ownerEmail, invited });
  }

  return betterAuth({
    appName: "Five Rounds",
    secret: deps.secret,
    baseURL: deps.baseURL,
    trustedOrigins: deps.trustedOrigins,
    database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
    user: {
      additionalFields: {
        onboardedAt: { type: "date", required: false, input: false },
      },
    },
    session: { expiresIn: SIXTY_DAYS, updateAge: 60 * 60 * 24 },
    socialProviders: deps.google
      ? { google: { clientId: deps.google.clientId, clientSecret: deps.google.clientSecret, prompt: "select_account" } }
      : {},
    databaseHooks: {
      user: {
        create: {
          // Covers every way in (magic link and Google): no account unless sign-ups allow it.
          before: async (newUser) => {
            if (!(await mayCreateAccount(newUser.email))) {
              throw new APIError("FORBIDDEN", { message: "Sign-ups are invite-only right now." });
            }
            return { data: { ...newUser, email: normalizeEmail(newUser.email) } };
          },
          after: async (created) => {
            await db.update(invites).set({ usedAt: new Date() }).where(eq(invites.email, normalizeEmail(created.email)));
          },
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: 60 * 15,
        sendMagicLink: async ({ email, url, metadata }) => {
          const existing = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.email, normalizeEmail(email)))
            .limit(1);
          if (existing.length === 0) {
            if (metadata?.adult !== true) {
              throw new APIError("BAD_REQUEST", { message: "Confirm you're 18 or older to create an account." });
            }
            // Invite-only and not invited: send nothing, and don't say so (no account probing).
            if (!(await mayCreateAccount(email))) return;
          }
          await deps.sendMail({ to: email, url });
        },
      }),
      ...(deps.nextjs === false ? [] : [nextCookies()]), // nextCookies must stay last
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

function vercelOrigin(host: string | undefined): string | undefined {
  return host ? `https://${host}` : undefined;
}

function depsFromEnv(env: NodeJS.ProcessEnv = process.env): AuthDeps {
  const production = env.NODE_ENV === "production";
  const secret = env.AUTH_SECRET ?? (production ? undefined : "dev-only-secret-not-for-production-use-0000");
  if (!secret) throw new Error("AUTH_SECRET is not set.");

  // Previews are reached on the branch alias and on the per-deployment URL; both must be trusted.
  const preview = env.VERCEL_ENV === "preview";
  const baseURL =
    env.AUTH_URL ??
    (preview ? vercelOrigin(env.VERCEL_BRANCH_URL) : vercelOrigin(env.VERCEL_PROJECT_PRODUCTION_URL)) ??
    "http://localhost:3000";
  const trustedOrigins = [
    baseURL,
    vercelOrigin(env.VERCEL_URL),
    vercelOrigin(env.VERCEL_BRANCH_URL),
    vercelOrigin(env.VERCEL_PROJECT_PRODUCTION_URL),
  ].filter((o): o is string => Boolean(o));

  const google =
    env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
      ? { clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET }
      : undefined;

  return {
    db: getDb(),
    secret,
    baseURL,
    trustedOrigins: [...new Set(trustedOrigins)],
    sendMail: mailSenderFromEnv(env),
    signupMode: signupModeFrom(env.SIGNUP_MODE),
    ownerEmail: env.OWNER_EMAIL,
    google,
  };
}

let instance: Auth | undefined;

/** Built on first use, so importing this module never needs env vars (e.g. during `next build`). */
export function getAuth(): Auth {
  instance ??= createAuth(depsFromEnv());
  return instance;
}

export function googleSignInEnabled(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}
