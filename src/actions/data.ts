"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserError, userAction } from "@/lib/actions";
import { EXPORT_FORMAT, importLegacy, importV2, type ExportDoc } from "@/lib/db/data-store";
import { isLegacyState } from "@/lib/legacy/map";

/**
 * Imports a Five Rounds export (replaces everything, after an explicit confirm) or a
 * backup from the old app (merged in; safe to run twice).
 */
export const importData = userAction(
  z.object({ json: z.string().min(2).max(10_000_000), replace: z.boolean() }),
  async ({ json, replace }, { db }) => {
    let doc: unknown;
    try {
      doc = JSON.parse(json);
    } catch {
      throw new UserError("That isn't valid JSON.");
    }
    let summary: string;
    if (doc && typeof doc === "object" && (doc as { format?: string }).format === EXPORT_FORMAT) {
      if (!replace) throw new UserError("Tick the box to confirm: this replaces all your current data.");
      const n = await importV2(db, doc as ExportDoc);
      summary = `Restored ${n.sessions} sessions, ${n.logs} logs, ${n.foodLogs} food entries and ${n.weights} weigh-ins.`;
    } else if (isLegacyState(doc)) {
      const n = await importLegacy(db, doc);
      summary = `Imported from the old app: ${n.sessions} sessions, ${n.logs} logs, ${n.readiness} readiness days, ${n.weights} weigh-ins, ${n.foodLogs} food entries, ${n.meals} meals.`;
    } else {
      throw new UserError("This isn't a Five Rounds export or a backup from the old app.");
    }
    revalidatePath("/", "layout");
    return summary;
  },
);
