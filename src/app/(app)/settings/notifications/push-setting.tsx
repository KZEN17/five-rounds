"use client";

import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/actions/notifications";
import { Saving } from "@/components/spinner";

type State = "checking" | "unsupported" | "install-first" | "denied" | "off" | "on";

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The service worker only runs in production builds; don't wait forever for it in dev. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
}

export function PushSetting({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    let next: Promise<State>;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      next = Promise.resolve(ios && !standalone ? "install-first" : "unsupported");
    } else if (Notification.permission === "denied") {
      next = Promise.resolve("denied");
    } else {
      next = navigator.serviceWorker
        .getRegistration()
        .then((reg) => reg?.pushManager.getSubscription())
        .then((sub) => (sub ? "on" : "off"));
    }
    void next.then(setState);
  }, []);

  const turnOn = () =>
    start(async () => {
      setMsg("");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await registration();
      if (!reg) return setMsg("Notifications work in the installed app on the live site, not in a development build.");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const json = sub.toJSON();
      const res = await savePushSubscription({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "", userAgent: navigator.userAgent.slice(0, 200) });
      if (!res.ok) return setMsg(res.error);
      setState("on");
      setMsg("On. Your first report arrives tomorrow morning.");
    });

  const turnOff = () =>
    start(async () => {
      const reg = await registration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("off");
      setMsg("Off on this device.");
    });

  const test = () =>
    start(async () => {
      const res = await sendTestPush({});
      setMsg(res.ok ? "Sent. It should arrive in a few seconds." : res.error);
    });

  return (
    <div className="flex flex-col gap-2">
      {state === "checking" ? <p className="hint">Checking this device…</p> : null}
      {state === "install-first" ? (
        <p className="hint">
          On iPhone, notifications only work in the installed app. In Safari tap <b>Share → Add to Home Screen</b>, open Five Rounds from your Home Screen, then turn them on here.
        </p>
      ) : null}
      {state === "unsupported" ? <p className="hint">This browser can&apos;t receive notifications. Try the installed app or another browser.</p> : null}
      {state === "denied" ? (
        <p className="hint">Notifications are blocked for Five Rounds. Allow them in your phone&apos;s settings (Settings → Notifications → Five Rounds), then come back here.</p>
      ) : null}
      {state === "off" ? (
        <button type="button" className="btn btn-primary self-start" disabled={pending} onClick={turnOn}>
          Turn on morning reports
        </button>
      ) : null}
      {state === "on" ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={pending} onClick={test}>
            Send a test
          </button>
          <button type="button" className="btn btn-small" disabled={pending} onClick={turnOff}>
            Turn off on this device
          </button>
        </div>
      ) : null}
      <Saving pending={pending} label="Working…" />
      {msg && !pending ? (
        <p role="status" className="hint">
          {msg}
        </p>
      ) : null}
    </div>
  );
}

export function EmailSetting({ on, configured, email }: { on: boolean; configured: boolean; email: string }) {
  const [value, setValue] = useState(on);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  if (!configured) return <p className="hint">Email isn&apos;t set up on the server yet.</p>;
  return (
    <div className="flex flex-col gap-1">
      <label className="toggle">
        <input
          type="checkbox"
          checked={value}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setValue(next);
            start(async () => {
              const { setWeeklyEmail } = await import("@/actions/notifications");
              const res = await setWeeklyEmail({ on: next });
              setMsg(res.ok ? (next ? `Monday recaps go to ${email}.` : "Weekly emails off.") : res.error);
            });
          }}
        />
        Email me the weekly recap every Monday
      </label>
      {msg ? (
        <p role="status" className="hint">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
