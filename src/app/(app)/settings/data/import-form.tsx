"use client";

import { useState, useTransition } from "react";
import { importData } from "@/actions/data";

export function ImportForm() {
  const [json, setJson] = useState("");
  const [replace, setReplace] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="panel" aria-labelledby="import-heading">
      <h3 id="import-heading">Import</h3>
      <p className="hint">
        Load a Five Rounds export (replaces your current data) or paste the backup from the old app&apos;s Backup → Copy backup (merged in on real dates; importing it twice is safe).
      </p>
      <label className="field">
        Choose a file
        <input
          type="file"
          accept="application/json,.json,.txt"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) setJson(await file.text());
          }}
        />
      </label>
      <label className="field">
        …or paste it here
        <textarea rows={4} value={json} onChange={(e) => setJson(e.target.value)} placeholder='{"start": "2026-01-05", "logs": {…}}' />
      </label>
      <label className="toggle">
        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
        If this is a Five Rounds export, replace all my current data with it
      </label>
      <button
        type="button"
        className="btn btn-primary self-start"
        disabled={pending || !json.trim()}
        onClick={() =>
          start(async () => {
            const res = await importData({ json, replace });
            setMsg(res.ok ? { ok: true, text: res.data } : { ok: false, text: res.error });
          })
        }
      >
        {pending ? "Importing…" : "Import"}
      </button>
      {msg ? (
        <p role="status" className={`flag ${msg.ok ? "flag-ok" : "flag-warn"}`}>
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}
