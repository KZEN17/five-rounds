import { readFileSync } from "node:fs";
import { eq, isNull } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { foods } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/testing";
import { NEEDS_REVIEW, parseFoodsTsv, STAPLES } from "./tsv";

const parsed = parseFoodsTsv(readFileSync("data/foods.tsv", "utf8"));

describe("data/foods.tsv", () => {
  it("parses every row, with unique names", () => {
    expect(parsed).toHaveLength(175);
    expect(new Set(parsed.map((f) => f.name.toLowerCase())).size).toBe(175);
  });

  it("flags exactly the seven rows whose calories don't match their macros", () => {
    const flagged = parsed.filter((f) => f.needsReview).map((f) => f.name.toLowerCase()).sort();
    expect(flagged).toEqual([...NEEDS_REVIEW].sort());
  });

  it("cleans names and categories", () => {
    expect(parsed.find((f) => f.name.startsWith("Tuna Captain"))?.name).toBe("Tuna Captain Ocean soy oil");
    expect(parsed.find((f) => f.name === "Gjuvech Veggies")?.category).toBe("Vegetables");
  });
});

describe("the seed migration", () => {
  it("loads all foods plus the staples into the shared table", async () => {
    const db = await createTestDb();
    const rows = await db.select().from(foods).where(isNull(foods.ownerId));
    expect(rows).toHaveLength(175 + STAPLES.length);
    const [honey] = await db.select().from(foods).where(eq(foods.name, "Honey"));
    expect(honey).toMatchObject({ kcal: 304, p: 0.3, c: 82, f: 0, needsReview: false });
    const [ajvar] = await db.select().from(foods).where(eq(foods.name, "Ajvar"));
    expect(ajvar?.needsReview).toBe(true);
  });
});
