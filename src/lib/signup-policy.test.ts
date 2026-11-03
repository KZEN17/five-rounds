import { describe, expect, it } from "vitest";
import { canCreateAccount, normalizeEmail, signupModeFrom } from "./signup-policy";

describe("signup policy", () => {
  it("lets anyone sign up in open mode", () => {
    expect(canCreateAccount({ email: "a@x.com", mode: "open", invited: false })).toBe(true);
  });

  it("requires an invite in invite mode", () => {
    expect(canCreateAccount({ email: "a@x.com", mode: "invite", invited: false })).toBe(false);
    expect(canCreateAccount({ email: "a@x.com", mode: "invite", invited: true })).toBe(true);
  });

  it("always lets the owner sign up, whatever the case or spacing", () => {
    expect(canCreateAccount({ email: " Owner@X.com ", mode: "invite", ownerEmail: "owner@x.com", invited: false })).toBe(
      true,
    );
  });

  it("reads SIGNUP_MODE defensively and defaults to open", () => {
    expect(signupModeFrom("invite")).toBe("invite");
    expect(signupModeFrom(" INVITE ")).toBe("invite");
    expect(signupModeFrom(undefined)).toBe("open");
    expect(signupModeFrom("closed")).toBe("open");
  });

  it("normalizes emails", () => {
    expect(normalizeEmail("  Zlatko@Example.COM ")).toBe("zlatko@example.com");
  });
});
