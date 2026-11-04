import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { DeleteAccount } from "./delete-account";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user } = await requireUser();
  return (
    <>
      <h2>Settings</h2>
      <section className="panel" aria-labelledby="plan-heading">
        <h3 id="plan-heading">Your plan</h3>
        <p className="hint">Profile, competition, training days, equipment, strength style and nutrition all live in your plan answers. Change any of them and the plan regenerates. Logged sessions and past days stay as they are.</p>
        <Link href="/onboarding" className="btn self-start">
          Edit answers and regenerate
        </Link>
      </section>
      <section className="panel" aria-labelledby="devices-heading">
        <h3 id="devices-heading">Devices</h3>
        <p className="hint">Your watch, your Zone 2 heart-rate ceiling, and how to set up workouts on Apple Watch or Garmin.</p>
        <Link href="/settings/devices" className="btn self-start">
          Devices and watch guide
        </Link>
      </section>
      <section className="panel" aria-labelledby="notify-heading">
        <h3 id="notify-heading">Notifications</h3>
        <p className="hint">A morning report on your phone and a weekly recap by email.</p>
        <Link href="/settings/notifications" className="btn self-start">
          Notifications
        </Link>
      </section>
      <section className="panel" aria-labelledby="data-heading">
        <h3 id="data-heading">Your data</h3>
        <p className="hint">Download everything as JSON, restore from an export, or bring in a backup from the old Five Rounds app.</p>
        <Link href="/settings/data" className="btn self-start">
          Export and import
        </Link>
      </section>
      <section className="panel" aria-labelledby="account-heading">
        <h3 id="account-heading">Account</h3>
        <p>
          Signed in as <b>{user.email}</b>
        </p>
        <SignOutButton />
        <DeleteAccount />
      </section>
    </>
  );
}
