"use client";

import { useState, useTransition } from "react";
import { deleteMyAccount } from "@/actions/account";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <button type="button" className="btn btn-small self-start text-bad" onClick={() => setOpen(true)}>
        Delete my account…
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-bad/40 p-3">
      <p>
        This permanently deletes your account, plan, logs, food and weights. It can&apos;t be undone. Export your data first if you want to keep it.
      </p>
      <label className="field">
        Type DELETE to confirm
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
      </label>
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button
          type="button"
          className="btn border-bad bg-bad text-white"
          disabled={pending || confirm !== "DELETE"}
          onClick={() =>
            start(async () => {
              const res = await deleteMyAccount(confirm);
              if (res && "error" in res) setError(res.error);
            })
          }
        >
          {pending ? "Deleting…" : "Delete everything"}
        </button>
      </div>
      {error ? <p role="alert" className="flag flag-warn">{error}</p> : null}
    </div>
  );
}
