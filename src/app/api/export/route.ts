import { exportAll } from "@/lib/db/data-store";
import { requireUser } from "@/lib/session";

/** Downloads everything the signed-in user owns as JSON. */
export async function GET() {
  const { user, db } = await requireUser();
  const doc = await exportAll(db, user.email);
  return new Response(JSON.stringify(doc, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="five-rounds-${doc.exportedAt.slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
