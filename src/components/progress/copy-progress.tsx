"use client";

import { useState } from "react";

/** Copies the plain-text summary, falling back to a selectable box where the clipboard is blocked. */
export function CopyProgress({ text }: { text: string }) {
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);
  return (
    <section className="panel" aria-labelledby="copy-heading">
      <h3 id="copy-heading">Copy progress</h3>
      <p className="hint">A plain-text summary to paste into your notes or a chat with your coach.</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setMsg("Copied.");
            } catch {
              setShow(true);
              setMsg("Select all and copy.");
            }
          }}
        >
          Copy progress
        </button>
        <span className="hint" role="status">
          {msg}
        </span>
      </div>
      {show ? <textarea readOnly rows={8} value={text} onFocus={(e) => e.currentTarget.select()} /> : null}
    </section>
  );
}
