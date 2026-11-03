import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TabBar } from "@/components/tab-bar";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  if (!user.onboardedAt) redirect("/onboarding");
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();

  return (
    <div className="mx-auto flex max-w-140 flex-col gap-[18px] pt-[max(18px,env(safe-area-inset-top))] pb-[calc(96px+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between gap-3">
        <Link href="/today" className="font-display text-[22px] font-bold tracking-[0.02em] text-fg uppercase no-underline">
          Five Rounds
        </Link>
        <Link
          href="/settings"
          aria-label="Settings"
          className="grid size-11 place-items-center rounded-full bg-accent-soft font-display text-lg font-bold text-accent no-underline"
        >
          {initial}
        </Link>
      </header>
      <main className="flex flex-col gap-4">{children}</main>
      <TabBar />
    </div>
  );
}
