"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setWeekDone } from "@/actions/plan";
import { Spinner } from "@/components/spinner";

export function WeekToggle({ weekStart, week, done }: { weekStart: string; week: number; done: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="toggle text-sm">
      <input
        type="checkbox"
        checked={done}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setWeekDone({ weekStart, done: e.target.checked });
            router.refresh();
          })
        }
      />
      Week {week} completed
      {pending ? <Spinner className="text-muted" /> : null}
    </label>
  );
}
