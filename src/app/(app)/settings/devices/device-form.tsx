"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveDevice } from "@/actions/account";

export function DeviceForm({ device, z2 }: { device: "apple" | "garmin" | "none"; z2: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(device);
  const [ceiling, setCeiling] = useState(z2 == null ? "" : String(z2));
  const [msg, setMsg] = useState("");
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const bpm = ceiling.trim() ? Math.round(Number(ceiling)) : null;
          const res = await saveDevice({ device: value, z2CeilingBpm: bpm });
          setMsg(res.ok ? "Saved." : res.error);
          router.refresh();
        });
      }}
    >
      <h3>Your settings</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">
          Watch
          <select value={value} onChange={(e) => setValue(e.target.value as typeof value)}>
            <option value="apple">Apple Watch</option>
            <option value="garmin">Garmin</option>
            <option value="none">No watch</option>
          </select>
        </label>
        <label className="field">
          Zone 2 ceiling (bpm)
          <input inputMode="numeric" value={ceiling} onChange={(e) => setCeiling(e.target.value)} placeholder="e.g. 138" />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn btn-primary" disabled={pending}>
          Save
        </button>
        <span className="hint" role="status">
          {msg}
        </span>
      </div>
    </form>
  );
}
