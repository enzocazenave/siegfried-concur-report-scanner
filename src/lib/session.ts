/**
 * Session management via iron-session (signed + encrypted cookies).
 *
 * Sessions are stored entirely in the cookie (no server-side state). The
 * cookie is encrypted with SESSION_PASSWORD, so the contents cannot be
 * read or tampered with by the client.
 *
 * Why iron-session: lightweight (no DB tables), works in Node and Edge
 * runtimes, no extra infra.
 */

import { cookies } from "next/headers";
import { sealData, unsealData } from "iron-session";

export type SessionData = {
  userId: number;
  username: string;
  isMaster: boolean;
};

const COOKIE_NAME = "report-scanner-session";
const TTL_SECONDS = 60 * 60 * 8; // 8h working day

function getPassword(): string {
  const pw = process.env.SESSION_PASSWORD;
  if (!pw || pw.length < 32) {
    throw new Error(
      "SESSION_PASSWORD ausente o demasiado corta (necesita ≥ 32 caracteres). Mirá .env.example."
    );
  }
  return pw;
}

export async function getSession(): Promise<SessionData | null> {
  const jar = await cookies();
  const cookie = jar.get(COOKIE_NAME);
  if (!cookie) return null;
  try {
    return await unsealData<SessionData>(cookie.value, {
      password: getPassword(),
      ttl: TTL_SECONDS,
    });
  } catch {
    return null;
  }
}

export async function setSession(data: SessionData): Promise<void> {
  const sealed = await sealData(data, {
    password: getPassword(),
    ttl: TTL_SECONDS,
  });
  const jar = await cookies();
  jar.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
