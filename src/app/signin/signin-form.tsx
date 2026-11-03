"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInForm({ google }: { google: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: failed } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/today",
      newUserCallbackURL: "/today",
      errorCallbackURL: "/signin", // Better Auth appends ?error=INVALID_TOKEN etc.
      metadata: { adult },
    });
    setBusy(false);
    if (failed) setError(failed.message ?? "Couldn't send the link. Try again in a minute.");
    else router.push("/signin/check-email");
  }

  async function withGoogle() {
    setBusy(true);
    setError(null);
    const { error: failed } = await authClient.signIn.social({ provider: "google", callbackURL: "/today" });
    if (failed) {
      setBusy(false);
      setError(failed.message ?? "Google sign-in didn't work. Try the email link instead.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={sendLink} className="panel">
        <label className="field">
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className="toggle">
          <input type="checkbox" required checked={adult} onChange={(e) => setAdult(e.target.checked)} />
          I&apos;m 18 or older
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>

      {google ? (
        <div className="flex flex-col gap-2">
          <div className="hint text-center">or</div>
          <button type="button" className="btn" onClick={withGoogle} disabled={busy || !adult}>
            Continue with Google
          </button>
          {!adult ? <p className="hint text-center">Tick &ldquo;I&apos;m 18 or older&rdquo; to use Google.</p> : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="flag flag-warn">
          {error}
        </p>
      ) : null}
    </div>
  );
}
