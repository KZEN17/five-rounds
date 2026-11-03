import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { scoped } from "@/lib/db/scoped";

/** The signed-in session for this request, or null. Cached per request. */
export const getSession = cache(async () => {
  // Read headers first: it marks the page dynamic before anything needs env or a database.
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
});

/**
 * Use at the top of every signed-in page and Server Action. Redirects to sign-in
 * when there's no session, and returns a database handle locked to this user.
 */
export async function requireUser() {
  const current = await getSession();
  if (!current) redirect("/signin");
  return { user: current.user, db: scoped(getDb(), current.user.id) };
}
