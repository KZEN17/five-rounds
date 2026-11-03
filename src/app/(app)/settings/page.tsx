import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user } = await requireUser();
  return (
    <>
      <h2>Settings</h2>
      <section className="panel" aria-labelledby="account-heading">
        <h3 id="account-heading">Account</h3>
        <p>
          Signed in as <b>{user.email}</b>
        </p>
        <SignOutButton />
      </section>
    </>
  );
}
