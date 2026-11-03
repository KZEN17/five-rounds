export type SeedFood = { name: string; kcal: number; p: number; c: number; f: number; category: string; needsReview: boolean };

/** Rows whose calories don't match their macros in the owner's list: seeded with a "check label" flag. */
export const NEEDS_REVIEW = [
  "Tavche Gravche",
  "White Wine",
  "Cow cheese Bella Farm",
  "Urda Cheese",
  "GoOn protein",
  "Ajvar",
  "Chadena Shunka",
].map((n) => n.toLowerCase());

/** Raw/dry staples per 100 g, added on top of the owner's list. */
export const STAPLES: SeedFood[] = [
  { name: "White rice, dry", kcal: 360, p: 7, c: 79, f: 0.6, category: "Carbs", needsReview: false },
  { name: "Pasta, dry", kcal: 360, p: 13, c: 72, f: 1.5, category: "Carbs", needsReview: false },
  { name: "Beef mince 5%, raw", kcal: 125, p: 21.5, c: 0, f: 5, category: "Protein", needsReview: false },
  { name: "Beef mince 15%, raw", kcal: 215, p: 18.6, c: 0, f: 15, category: "Protein", needsReview: false },
  { name: "Milk, semi-skimmed", kcal: 47, p: 3.4, c: 4.8, f: 1.7, category: "Dairy", needsReview: false },
  { name: "Honey", kcal: 304, p: 0.3, c: 82, f: 0, category: "Carbs", needsReview: false },
];

const CATEGORY_ALIASES: Record<string, string> = { Veggies: "Vegetables" };

/**
 * Parses data/foods.tsv (name, serving, kcal, protein, carbs, fat, category).
 * Every serving in the file is 100 g, so the values are already per 100 g.
 */
export function parseFoodsTsv(tsv: string): SeedFood[] {
  const [, ...lines] = tsv.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line, i) => {
    const cols = line.split("\t");
    if (cols.length !== 7) throw new Error(`foods.tsv line ${i + 2}: expected 7 columns, got ${cols.length}`);
    const [name, serving, kcal, p, c, f, category] = cols as [string, string, string, string, string, string, string];
    if (serving.trim().toLowerCase() !== "100g") throw new Error(`foods.tsv line ${i + 2}: serving "${serving}" isn't 100 g`);
    const n = (v: string) => {
      const x = Number(v.trim());
      if (!Number.isFinite(x)) throw new Error(`foods.tsv line ${i + 2}: "${v}" isn't a number`);
      return x;
    };
    const clean = name.trim();
    const cat = category.trim();
    return {
      name: clean,
      kcal: n(kcal),
      p: n(p),
      c: n(c),
      f: n(f),
      category: CATEGORY_ALIASES[cat] ?? cat,
      needsReview: NEEDS_REVIEW.includes(clean.toLowerCase()),
    };
  });
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Idempotent SQL that inserts the shared foods (skips names that already exist). */
export function foodsSeedSql(foods: readonly SeedFood[]): string {
  const values = foods
    .map((x) => `  (${q(x.name)}, ${x.kcal}, ${x.p}, ${x.c}, ${x.f}, ${q(x.category)}, ${x.needsReview})`)
    .join(",\n");
  return `INSERT INTO "foods" ("name", "kcal", "p", "c", "f", "category", "needs_review") VALUES\n${values}\nON CONFLICT (lower("name")) WHERE "owner_id" IS NULL DO NOTHING;\n`;
}
