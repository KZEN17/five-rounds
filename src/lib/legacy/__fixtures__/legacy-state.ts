import type { LegacyState } from "../map";

/** A small legacy backup covering every kind of data the old app stored. */
export const legacyState: LegacyState = {
  start: "2026-01-05",
  sat: { "2": "row" },
  logs: {
    w1d0: { done: true, dur: "90", rpe: "8", rolls: "6", notes: "Good rounds" },
    "w1d1-atg": { done: true },
    w1d1: { done: true, dur: "30", avg: "128", max: "141", rpe: "3" },
    w1d5: { done: true, rounds: [{ rpe: "6", gas: "Attacking" }, { rpe: "7" }, { rpe: "8", gas: "Holding on" }] },
    w2d5: {
      done: true,
      rounds: [
        { end: "172", rec: "130", m: "1300" },
        { end: "175", rec: "134", m: "1290" },
        { end: "178", rec: "140", m: "1260" },
      ],
    },
    "w3d2-x1": { done: true, notes: "Session that was later removed" },
  },
  weeks: { "1": true },
  ready: { "2026-01-05": { sleep: "7.5", rhr: "52", hrv: "80" } },
  bikeCap: "138",
  custom: {
    w3d2: [
      { id: "p", type: "bjj" },
      { id: "xA", type: "other", title: "Wrestling", when: "Morning" },
    ],
  },
  fuel: {
    sex: "m",
    age: "35",
    height: "180",
    weights: { "2026-01-05": "82.1", "2026-01-06": "81,9" },
    food: { "2026-01-05": [{ id: "f1", name: "Oats", kcal: 389, p: 17, c: 66, f: 7 }] },
    ingr: { i1: { name: "Bar X", kcal: 400, p: 30, c: 40, f: 10 } },
    meals: { m1: { name: "Bowl", items: [{ name: "Rice", kcal: 130, p: 2.7, c: 28, f: 0.3, g: 200 }], serv: 2 } },
  },
};
