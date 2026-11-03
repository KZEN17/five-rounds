import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Check your email", robots: { index: false } };

export default function CheckEmail() {
  const dev = process.env.NODE_ENV !== "production" && !process.env.AUTH_RESEND_KEY;
  return (
    <main className="mx-auto flex max-w-105 flex-col gap-5 py-10">
      <header className="flex flex-col gap-1">
        <div className="eyebrow">Five Rounds</div>
        <h1>Check your email</h1>
      </header>
      <div className="panel">
        <p>If this address can sign in, a link is on its way. Open it on the device you want to use. It works once and expires in 15 minutes.</p>
        {dev ? <p className="hint">Development: the link is printed in the terminal running the dev server.</p> : null}
      </div>
      <Link href="/signin" className="btn">
        Use a different email
      </Link>
    </main>
  );
}
