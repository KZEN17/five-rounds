import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Database } from "./client";

/** Any table with a `userId` column: everything that belongs to one user. */
export type OwnedTable = PgTable & { userId: PgColumn };
type OwnedValues<T extends OwnedTable> = Omit<T["$inferInsert"], "userId">;

/**
 * The only way app code reads or writes user data. Every query it builds is
 * limited to `userId`, and every insert is stamped with it, so a caller can't
 * reach another user's rows even by passing their ids.
 */
export function scoped(db: Database, userId: string) {
  /** `user_id = me AND ...conditions`. Use it in joins and custom queries. */
  const owns = (table: OwnedTable, ...conditions: (SQL | undefined)[]): SQL =>
    and(eq(table.userId, userId), ...conditions) as SQL; // never undefined: the first condition is always present

  const stamp = <T extends OwnedTable>(values: OwnedValues<T>) =>
    // Spread first, then force userId, so a stray userId in `values` can't win.
    ({ ...values, userId }) as T["$inferInsert"];

  return {
    userId,
    owns,
    select<T extends OwnedTable>(table: T, where?: SQL) {
      return db.select().from(table as PgTable).where(owns(table, where));
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
  };
}

export type ScopedDb = ReturnType<typeof scoped>;
