"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await authClient.signOut();
    // Cached pages hold this user's data: clear them on a shared device.
    if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k))).catch(() => {});
    router.replace("/");
    router.refresh();
  }

  return (
    <button type="button" className="btn self-start" onClick={signOut} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
