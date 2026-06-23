/**
 * Auth helpers used by API routes and server components.
 */

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getSession, type SessionData } from "@/lib/session";

/** For server components: redirect to /login if not authenticated. */
export async function requireSessionForPage(): Promise<SessionData> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** For server components: require master, otherwise redirect home. */
export async function requireMasterForPage(): Promise<SessionData> {
  const session = await requireSessionForPage();
  if (!session.isMaster) redirect("/");
  return session;
}

/**
 * For API routes: returns the session, or a Response if unauthenticated.
 *
 *   const guard = await requireSessionForApi();
 *   if (guard instanceof NextResponse) return guard;
 *   // … use guard.userId etc.
 */
export async function requireSessionForApi(): Promise<SessionData | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401 }
    );
  }
  return session;
}

export async function requireMasterForApi(): Promise<SessionData | NextResponse> {
  const guard = await requireSessionForApi();
  if (guard instanceof NextResponse) return guard;
  if (!guard.isMaster) {
    return NextResponse.json(
      { error: "Solo el usuario maestro puede realizar esta acción." },
      { status: 403 }
    );
  }
  return guard;
}
