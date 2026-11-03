"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkPending } from "@/components/spinner";

const icon = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true } as const;

const TABS = [
  {
    href: "/today",
    label: "Today",
    svg: (
      <svg {...icon}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.8 2.8L16 9.8" />
      </svg>
    ),
  },
  {
    href: "/plan",
    label: "Plan",
    svg: (
      <svg {...icon}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    href: "/timer",
    label: "Timer",
    svg: (
      <svg {...icon}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2 2M9 2h6" />
      </svg>
    ),
  },
  {
    href: "/fuel",
    label: "Fuel",
    svg: (
      <svg {...icon}>
        <path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z" />
        <path d="M12 18a3 3 0 0 1-3-3" />
      </svg>
    ),
  },
  {
    href: "/progress",
    label: "Progress",
    svg: (
      <svg {...icon}>
        <path d="M3 20h18M6 16l4-5 3 3 5-7" />
      </svg>
    ),
  },
] as const;

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 flex justify-center border-t border-line bg-surface px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))]"
    >
      <ul className="grid w-full max-w-140 grid-cols-5 gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[10px] py-1.5 text-[11px] font-semibold tracking-[0.04em] uppercase no-underline [&_svg]:size-[22px] ${
                  active ? "bg-accent-soft text-accent" : "text-muted"
                }`}
              >
                {tab.svg}
                {tab.label}
                <LinkPending className="absolute top-1 right-2" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
