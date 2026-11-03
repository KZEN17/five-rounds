import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth, type AuthDeps } from "./auth";
import type { Database } from "./db/client";
import { invites, user } from "./db/schema";
import { createTestDb } from "./db/testing";
import type { SignInMail } from "./mail";

let db: Database;
let sent: SignInMail[];

function makeAuth(overrides: Partial<AuthDeps> = {}) {
  return createAuth({
    db,
    secret: "test-secret-test-secret-test-secret-00",
    baseURL: "http://localhost:3000",
    trustedOrigins: ["http://localhost:3000"],
    sendMail: async (mail) => {
      sent.push(mail);
    },
    signupMode: "open",
    nextjs: false,
    ...overrides,
  });
}

const headers = () => new Headers({ origin: "http://localhost:3000" });

async function requestLink(auth: ReturnType<typeof makeAuth>, email: string, adult = true) {
  return auth.api.signInMagicLink({ body: { email, metadata: adult ? { adult: true } : {} }, headers: headers() });
}

beforeEach(async () => {
  db = await createTestDb();
  sent = [];
});

describe("magic-link sign-in", () => {
  it("emails a link, and opening it creates the account and a session", async () => {
    const auth = makeAuth();
    await requestLink(auth, "New.Person@Example.com");
    expect(sent).toHaveLength(1);

    const token = new URL(sent[0]!.url).searchParams.get("token");
    expect(token).toBeTruthy();
    const res = await auth.api.magicLinkVerify({ query: { token: token! }, headers: headers(), asResponse: true });
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("session_token");

    const current = await auth.api.getSession({ headers: new Headers({ cookie: cookie!.split(";")[0]! }) });
    expect(current?.user.email).toBe("new.person@example.com");
    expect(await db.select().from(user)).toHaveLength(1);
  });

  it("won't start an account without the 18+ confirmation", async () => {
    const auth = makeAuth();
    await expect(requestLink(auth, "kid@example.com", false)).rejects.toThrow(/18 or older/);
    expect(sent).toHaveLength(0);
  });

  it("in invite mode, quietly sends nothing to an uninvited email", async () => {
    const auth = makeAuth({ signupMode: "invite" });
    await requestLink(auth, "stranger@example.com");
    expect(sent).toHaveLength(0);
  });

  it("in invite mode, sends to invited emails and the owner, and marks the invite used", async () => {
    await db.insert(invites).values({ email: "friend@example.com" });
    const auth = makeAuth({ signupMode: "invite", ownerEmail: "owner@example.com" });
    await requestLink(auth, "friend@example.com");
    await requestLink(auth, "owner@example.com");
    expect(sent.map((m) => m.to)).toEqual(["friend@example.com", "owner@example.com"]);

    const token = new URL(sent[0]!.url).searchParams.get("token")!;
    await auth.api.magicLinkVerify({ query: { token }, headers: headers() });
    const [invite] = await db.select().from(invites).where(eq(invites.email, "friend@example.com"));
    expect(invite?.usedAt).toBeInstanceOf(Date);
  });

  it("existing users can always sign in, even in invite mode without the 18+ flag", async () => {
    await db.insert(user).values({ id: "u1", name: "", email: "member@example.com" });
    const auth = makeAuth({ signupMode: "invite" });
    await requestLink(auth, "member@example.com", false);
    expect(sent).toHaveLength(1);
  });
});

describe("when email can't be sent", () => {
  it("passes the reason back to the sign-in form", async () => {
    const auth = makeAuth({
      sendMail: async () => {
        throw new Error("Email sign-in isn't configured. Set AUTH_RESEND_KEY and EMAIL_FROM.");
      },
    });
    await expect(requestLink(auth, "someone@example.com")).rejects.toThrow(/isn't configured/);
  });
});
