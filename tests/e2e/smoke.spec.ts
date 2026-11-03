import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const EMAIL = `smoke-${Date.now()}@example.com`;

async function signInLink(): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const lines = (await readFile(".pglite-e2e/mail.log", "utf8").catch(() => "")).trim().split("\n").filter(Boolean);
    const mine = lines.map((l) => JSON.parse(l) as { to: string; url: string }).filter((m) => m.to === EMAIL);
    if (mine.length) return mine[mine.length - 1]!.url;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("No sign-in email arrived");
}

test("sign in → onboarding → plan visible → log a session", async ({ page }) => {
  // Sign in with a magic link.
  await page.goto("/");
  await page.getByRole("link", { name: /sign in/i }).click();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("I'm 18 or older").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto(await signInLink());

  // Onboarding: first-run users land in the wizard; defaults are enough to get a plan.
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByRole("heading", { name: "You" })).toBeVisible();
  await page.screenshot({ path: "test-results/screens/onboarding.png", fullPage: true });
  for (let step = 0; step < 6; step++) await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Build my plan" }).click();

  // The plan.
  await expect(page).toHaveURL(/\/plan/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /^Week \d+$/ })).toBeVisible();
  await expect(page.getByText("Hard BJJ").first()).toBeVisible();
  await page.screenshot({ path: "test-results/screens/plan.png", fullPage: true });

  // Log today's first session from Today.
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  const done = page.getByLabel("Session done").first();
  if (await done.count()) {
    await page.getByLabel("Minutes", { exact: true }).first().fill("60");
    await page.getByRole("button", { name: "Save log" }).first().click();
    await expect(page.getByRole("status").first()).toHaveText("Saved.");
    await done.check();
    await expect(page.getByText("60 min").first()).toBeVisible();
  }
  await page.screenshot({ path: "test-results/screens/today.png", fullPage: true });

  // Readiness: a short night flags the day.
  await page.getByLabel("Sleep h").fill("5.5");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Ease off today.")).toBeVisible();

  // Timer runs.
  await page.getByRole("link", { name: "Timer", exact: true }).click();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("timer")).not.toHaveText("0:10", { timeout: 5_000 });
  await page.screenshot({ path: "test-results/screens/timer.png" });
});
