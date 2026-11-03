import { and, eq, isNull, or, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Database } from "./client";
import { foods } from "./schema";

/** Any table with a `userId` column: everything that belongs to one user. */
export type OwnedTable = PgTable & { userId: PgColumn };
type OwnedValues<T extends OwnedTable> = Omit<T["$inferInsert"], "userId">;

/** The part of Drizzle's select builder we use, typed with the table's row. */
export interface Rows<R> extends PromiseLike<R[]> {
  orderBy(...columns: (PgColumn | SQL | SQL.Aliased)[]): Rows<R>;
  limit(n: number): Rows<R>;
}

/**
 * Raw handle for the query modules in src/lib/db (joins). Lint stops app code
 * importing it, so outside this folder there's no way round the user filter.
 */
export const RAW = Symbol("raw-db");

function base(db: Database, userId: string) {
  /** `user_id = me AND ...conditions`. */
  const owns = (table: OwnedTable, ...conditions: (SQL | undefined)[]): SQL =>
    and(eq(table.userId, userId), ...conditions) as SQL; // never undefined: the first condition is always present

  const stamp = <T extends OwnedTable>(values: OwnedValues<T>) =>
    // Spread first, then force userId, so a stray userId in `values` can't win.
    ({ ...values, userId }) as T["$inferInsert"];

  return {
    userId,
    owns,
    [RAW]: db,
    select<T extends OwnedTable>(table: T, where?: SQL): Rows<T["$inferSelect"]> {
      // Drizzle can't follow a generic table through from(); this restores T's row type.
      return db.select().from(table as PgTable).where(owns(table, where)) as unknown as Rows<T["$inferSelect"]>;
    },
    insert<T extends OwnedTable>(table: T, values: OwnedValues<T> | OwnedValues<T>[]) {
      const rows = Array.isArray(values) ? values.map((v) => stamp<T>(v)) : [stamp<T>(values)];
      return db.insert(table).values(rows);
    },
    update<T extends OwnedTable>(table: T, set: Partial<OwnedValues<T>>, where?: SQL) {
      const { userId: _userId, ...rest } = set as Record<string, unknown>;
      return db
        .update(table)
        .set(rest as Partial<T["$inferInsert"]>)
        .where(owns(table, where));
    },
    delete<T extends OwnedTable>(table: T, where?: SQL) {
      return db.delete(table).where(owns(table, where));
    },
    /** Foods are shared (owner null) or private: read both, write only your own. */
    foods: {
      visible: (where?: SQL) =>
        db.select().from(foods).where(and(or(isNull(foods.ownerId), eq(foods.ownerId, userId)), where)),
      insert: (values: Omit<typeof foods.$inferInsert, "ownerId" | "id">) =>
        db.insert(foods).values({ ...values, ownerId: userId }),
      delete: (id: string) => db.delete(foods).where(and(eq(foods.id, id), eq(foods.ownerId, userId))),
    },
  };
}

export type ScopedDb = ReturnType<typeof base> & {
  /** Run several writes atomically, with the same user lock inside. */
  transaction<R>(fn: (tx: ScopedDb) => Promise<R>): Promise<R>;
};

/**
 * The only way app code reads or writes user data. Every query it builds is
 * limited to `userId`, and every insert is stamped with it, so a caller can't
 * reach another user's rows even by passing their ids.
 */
export function scoped(db: Database, userId: string): ScopedDb {
  return { ...base(db, userId), transaction: (fn) => db.transaction((tx) => fn(scoped(tx, userId))) };
}
