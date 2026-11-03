import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { googleSignInEnabled } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { SignInForm } from "./signin-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getSession()) redirect("/today");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex max-w-105 flex-col gap-5 py-10">
      <header className="flex flex-col gap-1">
        <div className="eyebrow">Five Rounds</div>
        <h1>Sign in</h1>
        <p className="text-muted">We email you a link. No password to remember. New here? The same link creates your account.</p>
      </header>
      {error ? (
        <p role="alert" className="flag flag-warn">
          That link has expired or was already used. Ask for a new one below.
        </p>
      ) : null}
      <SignInForm google={googleSignInEnabled()} />
    </main>
  );
}
