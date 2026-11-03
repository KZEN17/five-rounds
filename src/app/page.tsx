import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

const FEATURES = [
  ["A plan to your date", "Week-by-week conditioning, strength and BJJ load, built backwards from your competition."],
  ["Rounds that match", "Interval and comp-sim rounds at your match length, building to the number of matches you'll fight."],
  ["Fuel and weight", "Daily calorie and macro targets from your training, and a safe rate to your division."],
  ["Readiness", "Sleep, resting HR and HRV against your own baseline. It suggests easing off. It never forces it."],
] as const;

export default async function Landing({ searchParams }: { searchParams: Promise<{ under18?: string }> }) {
  if (await getSession()) redirect("/today");
  const { under18 } = await searchParams;

  return (
    <main className="mx-auto flex max-w-140 flex-col gap-6 py-10">
      <header className="flex flex-col gap-2">
        <div className="eyebrow">Competition prep for grapplers</div>
        <h1>Five Rounds</h1>
        <p className="text-muted">
          Tell it when you compete, how you train now and what you weigh. It builds your plan, sets your daily
          targets, and shows you whether the work is landing.
        </p>
      </header>

      {under18 ? (
        <p role="alert" className="flag flag-warn">
          Five Rounds is for adults (18+), so we&apos;ve deleted that account. Thanks for understanding.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {FEATURES.map(([title, text]) => (
          <li key={title} className="panel gap-1">
            <h3>{title}</h3>
            <p className="hint">{text}</p>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <Link href="/signin" className="btn btn-primary">
          Sign in or create an account
        </Link>
        <p className="hint">
          For adults (18+). Training and nutrition guidance, not medical advice. Your data stays yours: export it or
          delete it any time.
        </p>
      </div>
    </main>
  );
}
