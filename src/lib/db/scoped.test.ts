import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "./client";
import { profiles, user } from "./schema";
import { scoped } from "./scoped";
import { createTestDb } from "./testing";

let db: Database;

async function addUser(id: string) {
  await db.insert(user).values({ id, name: id, email: `${id}@example.com` });
}

beforeEach(async () => {
  db = await createTestDb();
  await addUser("alice");
  await addUser("bob");
  await scoped(db, "alice").insert(profiles, { age: 31, heightCm: 180 });
});

describe("scoped(): one user can never reach another user's rows", () => {
  it("reads only the caller's rows", async () => {
    expect(await scoped(db, "alice").select(profiles)).toHaveLength(1);
    expect(await scoped(db, "bob").select(profiles)).toHaveLength(0);
    // Even when bob asks for alice's row by id.
    expect(await scoped(db, "bob").select(profiles, eq(profiles.userId, "alice"))).toHaveLength(0);
  });

  it("updates only the caller's rows", async () => {
    await scoped(db, "bob").update(profiles, { age: 99 }, eq(profiles.userId, "alice"));
    const [row] = await db.select().from(profiles).where(eq(profiles.userId, "alice"));
    expect(row?.age).toBe(31);
  });

  it("cannot move a row to another user through update", async () => {
    // userId isn't in the allowed type; force it the way a careless caller might.
    await scoped(db, "alice").update(profiles, { userId: "bob", age: 32 } as Partial<typeof profiles.$inferInsert>);
    const rows = await db.select().from(profiles);
    expect(rows).toEqual([expect.objectContaining({ userId: "alice", age: 32 })]);
  });

  it("deletes only the caller's rows", async () => {
    await scoped(db, "bob").delete(profiles, eq(profiles.userId, "alice"));
    expect(await db.select().from(profiles)).toHaveLength(1);
  });

  it("stamps inserts with the caller's id, even if another id is passed", async () => {
    await scoped(db, "bob").insert(profiles, { userId: "alice", age: 40 } as typeof profiles.$inferInsert);
    const rows = await db.select().from(profiles).where(eq(profiles.age, 40));
    expect(rows.map((r) => r.userId)).toEqual(["bob"]);
  });

  it("deletes a user's data with the account", async () => {
    await db.delete(user).where(eq(user.id, "alice"));
    expect(await db.select().from(profiles)).toHaveLength(0);
  });
});
