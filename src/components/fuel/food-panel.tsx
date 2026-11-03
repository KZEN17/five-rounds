"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { addFoodLog, createFood, deleteFood, deleteFoodLog, deleteMeal, saveMeal } from "@/actions/fuel";
import type { ActionResult } from "@/lib/actions";
import type { FoodOption } from "@/lib/db/fuel-store";
import type { MealItem } from "@/lib/db/schema";
import { Saving } from "@/components/spinner";

type Log = { id: string; name: string; kcal: number; p: number | null; c: number | null; f: number | null; ingredients: string | null };
type Recent = Omit<Log, "id">;
type Meal = { id: string; name: string; items: MealItem[]; portions: number };
type Draft = { name: string; items: MealItem[]; serv: number; eat: number };

const EMPTY: Draft = { name: "", items: [], serv: 1, eat: 1 };
const DRAFT_KEY = "five-rounds:meal-draft";
const num = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const n0 = (v: number) => Math.round(v).toLocaleString("en-GB");
const r1 = (v: number) => Math.round(v * 10) / 10;
const per = (x: MealItem) => ({ k: (x.kcal * x.g) / 100, p: (x.p * x.g) / 100, c: (x.c * x.g) / 100, f: (x.f * x.g) / 100 });

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const run = (fn: () => Promise<ActionResult<unknown>>, ok?: string) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? (ok ?? "") : res.error);
      router.refresh();
    });
  return { pending, msg, setMsg, run };
}

export function FoodPanel({ date, isToday, logs, recent, foods, meals }: { date: string; isToday: boolean; logs: Log[]; recent: Recent[]; foods: FoodOption[]; meals: Meal[] }) {
  const [mode, setMode] = useState<"build" | "quick">("build");
  const { pending, msg, run } = useRun();
  const total = logs.reduce((a, x) => ({ k: a.k + x.kcal, p: a.p + (x.p ?? 0), c: a.c + (x.c ?? 0), f: a.f + (x.f ?? 0) }), { k: 0, p: 0, c: 0, f: 0 });
  const add = (x: Recent) => run(() => addFoodLog({ date, name: x.name, kcal: x.kcal, p: x.p, c: x.c, f: x.f, ingredients: x.ingredients }));

  return (
    <section className="panel" aria-labelledby="food-heading">
      <h3 id="food-heading">Food</h3>
      <div className="seg" role="group" aria-label="How to add food">
        <button type="button" aria-pressed={mode === "build"} onClick={() => setMode("build")}>
          Build a meal
        </button>
        <button type="button" aria-pressed={mode === "quick"} onClick={() => setMode("quick")}>
          Quick add
        </button>
      </div>
      {mode === "build" ? <MealBuilder date={date} foods={foods} meals={meals} /> : <QuickAdd onAdd={add} pending={pending} />}

      {recent.length ? (
        <div>
          <div className="eyebrow mb-1.5">Add again</div>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((x) => (
              <button key={x.name} type="button" className="btn btn-small rounded-full text-fg" disabled={pending} onClick={() => add(x)}>
                {x.name} <span className="text-muted">{n0(x.kcal)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="eyebrow">Logged {isToday ? "today" : "this day"}</div>
      {logs.length ? (
        <div className="overflow-x-auto">
          <table className="rounds-table">
            <thead>
              <tr>
                <th>Food</th>
                <th>kcal</th>
                <th>P</th>
                <th>C</th>
                <th>F</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {logs.map((x) => (
                <tr key={x.id}>
                  <td>
                    {x.name}
                    {x.ingredients ? <div className="hint text-[11px]">{x.ingredients}</div> : null}
                  </td>
                  <td className="num">{n0(x.kcal)}</td>
                  <td className="num">{x.p ?? "–"}</td>
                  <td className="num">{x.c ?? "–"}</td>
                  <td className="num">{x.f ?? "–"}</td>
                  <td>
                    <button type="button" className="btn btn-small" aria-label={`Remove ${x.name}`} disabled={pending} onClick={() => run(() => deleteFoodLog({ id: x.id }))}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td>Total</td>
                <td className="num">{n0(total.k)}</td>
                <td className="num">{n0(total.p)}</td>
                <td className="num">{n0(total.c)}</td>
                <td className="num">{n0(total.f)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="hint">Nothing logged {isToday ? "today" : "for this day"} yet.</p>
      )}
      <Saving pending={pending} />
      {msg && !pending ? <p role="status" className="hint">{msg}</p> : null}
    </section>
  );
}

function QuickAdd({ onAdd, pending }: { onAdd: (x: Recent) => void; pending: boolean }) {
  const [v, setV] = useState({ name: "", kcal: "", p: "", c: "", f: "" });
  const [error, setError] = useState("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const p = num(v.p), c = num(v.c), f = num(v.f);
        let kcal = num(v.kcal);
        if (kcal == null && (p != null || c != null || f != null)) kcal = Math.round((p ?? 0) * 4 + (c ?? 0) * 4 + (f ?? 0) * 9);
        if (!v.name.trim() && kcal == null) return setError("Add a name or some calories first.");
        setError("");
        onAdd({ name: v.name.trim() || "Food", kcal: kcal ?? 0, p, c, f, ingredients: null });
        setV({ name: "", kcal: "", p: "", c: "", f: "" });
      }}
    >
      <label className="field">
        Food
        <input value={v.name} onChange={set("name")} placeholder="e.g. Chicken rice bowl" />
      </label>
      <div className="grid grid-cols-4 gap-2">
        <label className="field">
          kcal
          <input inputMode="numeric" value={v.kcal} onChange={set("kcal")} placeholder="auto" />
        </label>
        <label className="field">
          Protein g
          <input inputMode="decimal" value={v.p} onChange={set("p")} />
        </label>
        <label className="field">
          Carbs g
          <input inputMode="decimal" value={v.c} onChange={set("c")} />
        </label>
        <label className="field">
          Fat g
          <input inputMode="decimal" value={v.f} onChange={set("f")} />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn btn-primary" disabled={pending}>
          Add food
        </button>
        <span className="hint">{error || "Leave kcal empty to work it out from the macros."}</span>
      </div>
    </form>
  );
}

function MealBuilder({ date, foods, meals }: { date: string; foods: FoodOption[]; meals: Meal[] }) {
  const { pending, msg, setMsg, run } = useRun();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [query, setQuery] = useState("");
  const [grams, setGrams] = useState("");
  const [pick, setPick] = useState<FoodOption | null>(null);

  // The draft survives reloads on this device.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring per-device state once on mount
      if (saved) setDraft({ ...EMPTY, ...(JSON.parse(saved) as Draft) });
    } catch {
      // Storage blocked or corrupt: start empty.
    }
  }, []);
  const update = (next: Draft) => {
    setDraft(next);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      // Private mode: the draft just won't persist.
    }
  };

  const matches = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length || (pick && pick.name === query)) return [];
    return foods.filter((x) => words.every((w) => x.name.toLowerCase().includes(w))).slice(0, 10);
  }, [query, foods, pick]);

  const totals = draft.items.reduce(
    (t, x) => {
      const v = per(x);
      return { k: t.k + v.k, p: t.p + v.p, c: t.c + v.c, f: t.f + v.f };
    },
    { k: 0, p: 0, c: 0, f: 0 },
  );
  const ratio = (draft.eat || 1) / (draft.serv || 1);
  const ate = { k: totals.k * ratio, p: totals.p * ratio, c: totals.c * ratio, f: totals.f * ratio };

  function addItem() {
    const food = pick ?? foods.find((x) => x.name.toLowerCase() === query.trim().toLowerCase());
    const g = num(grams);
    if (!food) return setMsg("Pick an ingredient from the list.");
    if (!g || g <= 0) return setMsg("Enter the grams.");
    update({ ...draft, items: [...draft.items, { name: food.name, kcal: food.kcal, p: food.p, c: food.c, f: food.f, g }] });
    setQuery("");
    setGrams("");
    setPick(null);
    setMsg("");
  }

  return (
    <div className="flex flex-col gap-2.5">
      <label className="field">
        Meal name
        <input value={draft.name} onChange={(e) => update({ ...draft, name: e.target.value })} placeholder="e.g. Chicken rice bowl" />
      </label>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] items-end gap-2">
        <label className="field">
          Ingredient
          <input
            autoComplete="off"
            value={query}
            placeholder="Search: chicken, rice, oats…"
            onChange={(e) => {
              setQuery(e.target.value);
              if (pick && pick.name !== e.target.value) setPick(null);
            }}
          />
        </label>
        <label className="field">
          Grams
          <input
            inputMode="decimal"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder="g"
          />
        </label>
        <button type="button" className="btn btn-primary" onClick={addItem}>
          Add
        </button>
      </div>
      {matches.length ? (
        <ul className="flex flex-col overflow-hidden rounded-[10px] border border-line" role="listbox" aria-label="Matching ingredients">
          {matches.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="flex min-h-11 w-full items-center justify-between gap-2 border-t border-line px-3 py-2 text-left first:border-t-0"
                onClick={() => {
                  setPick(x);
                  setQuery(x.name);
                }}
              >
                <span>
                  {x.name}{" "}
                  {x.mine ? <em className="text-xs text-accent not-italic">mine</em> : <em className="text-xs text-muted not-italic">{x.category}</em>}
                  {x.needsReview ? <span className="tag ml-1.5 bg-warn/20 text-warn">check label</span> : null}
                </span>
                <span className="hint shrink-0">
                  {n0(x.kcal)} kcal · P{x.p} C{x.c} F{x.f}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : query.trim() && !pick ? (
        <p className="hint">No match. Add it below as your own ingredient.</p>
      ) : null}

      {draft.items.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="rounds-table">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>g</th>
                  <th>kcal</th>
                  <th>P</th>
                  <th>C</th>
                  <th>F</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {draft.items.map((x, i) => {
                  const v = per(x);
                  return (
                    <tr key={`${x.name}-${i}`}>
                      <td>{x.name}</td>
                      <td>
                        <input
                          aria-label={`${x.name} grams`}
                          inputMode="decimal"
                          className="min-h-9 w-16 py-1"
                          value={x.g}
                          onChange={(e) => update({ ...draft, items: draft.items.map((y, j) => (j === i ? { ...y, g: num(e.target.value) ?? 0 } : y)) })}
                        />
                      </td>
                      <td className="num">{n0(v.k)}</td>
                      <td className="num">{r1(v.p)}</td>
                      <td className="num">{r1(v.c)}</td>
                      <td className="num">{r1(v.f)}</td>
                      <td>
                        <button type="button" className="btn btn-small" aria-label={`Remove ${x.name}`} onClick={() => update({ ...draft, items: draft.items.filter((_, j) => j !== i) })}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="font-semibold">
                  <td>Whole meal</td>
                  <td />
                  <td className="num">{n0(totals.k)}</td>
                  <td className="num">{r1(totals.p)}</td>
                  <td className="num">{r1(totals.c)}</td>
                  <td className="num">{r1(totals.f)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="field">
              Makes portions
              <input inputMode="decimal" value={draft.serv} onChange={(e) => update({ ...draft, serv: num(e.target.value) ?? 1 })} />
            </label>
            <label className="field">
              You ate
              <input inputMode="decimal" value={draft.eat} onChange={(e) => update({ ...draft, eat: num(e.target.value) ?? 1 })} />
            </label>
          </div>
          <p>
            You ate <b>{n0(ate.k)} kcal</b> · P {n0(ate.p)} g · C {n0(ate.c)} g · F {n0(ate.f)} g{ratio !== 1 ? ` (${(ratio * 100).toFixed(0)}% of the meal)` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() => {
                const ingredients =
                  draft.items.map((x) => `${x.name.split(",")[0]} ${x.g}g`).join(", ") + (ratio !== 1 ? ` · ${draft.eat} of ${draft.serv} portions` : "");
                run(
                  () => addFoodLog({ date, name: draft.name.trim() || "Meal", kcal: Math.round(ate.k), p: r1(ate.p), c: r1(ate.c), f: r1(ate.f), ingredients }),
                  "Logged.",
                );
                update(EMPTY);
              }}
            >
              Log what I ate
            </button>
            <button
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => {
                if (!draft.name.trim()) return setMsg("Give the meal a name first.");
                run(() => saveMeal({ name: draft.name.trim(), items: draft.items, portions: draft.serv || 1 }), "Meal saved.");
              }}
            >
              Save meal
            </button>
            <button type="button" className="btn btn-small" onClick={() => update(EMPTY)}>
              Clear
            </button>
          </div>
        </>
      ) : (
        <p className="hint">Search an ingredient, enter the grams, tap Add. The totals build up here.</p>
      )}
      <Saving pending={pending} />
      {msg && !pending ? <p role="status" className="hint">{msg}</p> : null}

      {meals.length ? (
        <div>
          <div className="eyebrow mb-1.5">Saved meals · tap to load</div>
          <div className="flex flex-wrap gap-1.5">
            {meals.map((m) => (
              <span key={m.id} className="inline-flex overflow-hidden rounded-full border border-line">
                <button type="button" className="min-h-9 px-3 text-sm" onClick={() => update({ name: m.name, items: m.items, serv: m.portions, eat: 1 })}>
                  {m.name}
                </button>
                <button type="button" className="min-h-9 border-l border-line px-2.5 text-sm text-muted" aria-label={`Delete ${m.name}`} onClick={() => run(() => deleteMeal({ id: m.id }))}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <NewIngredient mine={foods.filter((f) => f.mine)} />
    </div>
  );
}

function NewIngredient({ mine }: { mine: FoodOption[] }) {
  const { pending, msg, run } = useRun();
  const [v, setV] = useState({ name: "", kcal: "", p: "", c: "", f: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <details className="rounded-[10px] bg-sunk p-3">
      <summary className="cursor-pointer font-medium text-accent">Add your own ingredient (from the label, per 100 g)</summary>
      <div className="mt-2 flex flex-col gap-2">
        <label className="field">
          Name
          <input value={v.name} onChange={set("name")} placeholder="e.g. Protein bar brand X" />
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(["kcal", "p", "c", "f"] as const).map((k) => (
            <label key={k} className="field">
              {k === "kcal" ? "kcal" : k === "p" ? "Protein" : k === "c" ? "Carbs" : "Fat"}
              <input inputMode="decimal" value={v[k]} onChange={set(k)} placeholder={k === "kcal" ? "auto" : ""} />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={() => run(() => createFood({ name: v.name.trim(), kcal: num(v.kcal), p: num(v.p) ?? 0, c: num(v.c) ?? 0, f: num(v.f) ?? 0 }), "Saved. Search for it above.")}
          >
            Save ingredient
          </button>
          <Saving pending={pending} />
          {msg && !pending ? <span className="hint" role="status">{msg}</span> : null}
        </div>
        {mine.length ? (
          <div className="flex flex-wrap gap-1.5">
            {mine.map((x) => (
              <span key={x.id} className="inline-flex items-center overflow-hidden rounded-full border border-line bg-surface">
                <span className="px-3 text-sm">
                  {x.name} <span className="text-muted">{n0(x.kcal)}/100g</span>
                </span>
                <button type="button" className="min-h-9 border-l border-line px-2.5 text-sm text-muted" aria-label={`Delete ${x.name}`} onClick={() => run(() => deleteFood({ id: x.id }))}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}
