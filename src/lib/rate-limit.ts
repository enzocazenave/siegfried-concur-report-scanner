/**
 * DB-backed rate limiting + scan quota.
 *
 * Single source of truth for all "is this allowed right now" decisions:
 *
 *   recordLoginAttempt / checkLoginRateLimit
 *     5 failed attempts per IP per 15 minutes blocks the IP for the
 *     remainder of the window. A successful login wipes failures for
 *     that IP.
 *
 *   checkScanRateLimit / recordScanAttempt
 *     Per-user burst (BURST_LIMIT scans per BURST_WINDOW_MS)
 *     + per-user daily quota (SCANS_PER_USER_PER_DAY).
 *
 * Both are persisted to SQLite via Prisma, so the limits survive process
 * restarts and work across multiple Next.js workers without coordination.
 */

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/* ────────────────────────  Login rate limit  ───────────────────────── */

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILED = 5;

export type LoginRateLimit = { allowed: true } | {
  allowed: false;
  retryAfterSeconds: number;
};

/** Returns the client IP using common proxy headers, or "unknown". */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || "unknown";
  const xri = h.get("x-real-ip");
  if (xri) return xri.trim() || "unknown";
  return "unknown";
}

export async function checkLoginRateLimit(ip: string): Promise<LoginRateLimit> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const failed = await prisma.loginAttempt.findMany({
    where: { ipAddress: ip, success: false, attemptedAt: { gte: since } },
    orderBy: { attemptedAt: "asc" },
    select: { attemptedAt: true },
  });
  if (failed.length < LOGIN_MAX_FAILED) return { allowed: true };

  // Block until the oldest failure leaves the window.
  const oldest = failed[0].attemptedAt.getTime();
  const retryAt = oldest + LOGIN_WINDOW_MS;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((retryAt - Date.now()) / 1000)
  );
  return { allowed: false, retryAfterSeconds };
}

export async function recordLoginAttempt(
  ip: string,
  success: boolean
): Promise<void> {
  await prisma.loginAttempt.create({ data: { ipAddress: ip, success } });
  if (success) {
    // Clean slate on success so a legitimate user retrying isn't penalized.
    await prisma.loginAttempt.deleteMany({
      where: { ipAddress: ip, success: false },
    });
  }
}

/* ────────────────────────  Scan rate limit  ────────────────────────── */

export const SCAN_BURST_WINDOW_MS = 60 * 1000;
export const SCAN_BURST_LIMIT = 10;

export function getDailyScanQuota(): number {
  const n = Number(process.env.SCANS_PER_USER_PER_DAY);
  if (!Number.isFinite(n) || n <= 0) return 200;
  return Math.floor(n);
}

export type ScanRateLimit = { allowed: true } | {
  allowed: false;
  reason: "burst" | "daily";
  retryAfterSeconds: number;
  /** Daily count and quota, for friendly user messages. */
  dailyCount?: number;
  dailyQuota?: number;
};

export async function checkScanRateLimit(userId: number): Promise<ScanRateLimit> {
  const now = Date.now();
  const burstSince = new Date(now - SCAN_BURST_WINDOW_MS);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [burst, today] = await Promise.all([
    prisma.scanAttempt.findMany({
      where: { userId, attemptedAt: { gte: burstSince } },
      orderBy: { attemptedAt: "asc" },
      select: { attemptedAt: true },
    }),
    prisma.scanAttempt.count({
      where: { userId, attemptedAt: { gte: startOfToday } },
    }),
  ]);

  const dailyQuota = getDailyScanQuota();
  if (today >= dailyQuota) {
    // Block until midnight local time.
    const tomorrow = new Date(startOfToday);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      allowed: false,
      reason: "daily",
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((tomorrow.getTime() - now) / 1000)
      ),
      dailyCount: today,
      dailyQuota,
    };
  }
  if (burst.length >= SCAN_BURST_LIMIT) {
    const oldest = burst[0].attemptedAt.getTime();
    return {
      allowed: false,
      reason: "burst",
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldest + SCAN_BURST_WINDOW_MS - now) / 1000)
      ),
    };
  }
  return { allowed: true };
}

export async function recordScanAttempt(userId: number): Promise<void> {
  await prisma.scanAttempt.create({ data: { userId } });
}
