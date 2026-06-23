import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { scanDocument } from "@/lib/server-ocr";
import { requireSessionForApi } from "@/lib/auth";
import {
  checkScanRateLimit,
  recordScanAttempt,
  SCAN_BURST_LIMIT,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vision requests are typically ~3-6 s; bump above the default to be safe.
export const maxDuration = 60;

const VALID_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type ValidType = (typeof VALID_TYPES)[number];

export async function POST(req: NextRequest) {
  const guard = await requireSessionForApi();
  if (guard instanceof NextResponse) return guard;

  // Rate limit + daily quota PER USER. We record the attempt BEFORE calling
  // Claude (i.e. counts even if Claude errors / image is unreadable). This
  // is intentional: each call costs money and a malicious user shouldn't be
  // able to spam by sending intentionally bad images.
  const limit = await checkScanRateLimit(guard.userId);
  if (!limit.allowed) {
    const message =
      limit.reason === "daily"
        ? `Alcanzaste la cuota diaria de escaneos (${limit.dailyQuota}). Probá mañana.`
        : `Demasiados escaneos seguidos. Esperá ${limit.retryAfterSeconds} segundo(s) antes del próximo (máximo ${SCAN_BURST_LIMIT} por minuto).`;
    return NextResponse.json(
      { error: message },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }
  await recordScanAttempt(guard.userId);

  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!VALID_TYPES.some((t) => contentType.startsWith(t))) {
    return NextResponse.json(
      {
        error:
          "Content-Type debe ser image/png, image/jpeg, image/webp o image/gif.",
      },
      { status: 400 }
    );
  }
  const mediaType = VALID_TYPES.find((t) =>
    contentType.startsWith(t)
  ) as ValidType;

  let buffer: Buffer;
  try {
    const arrayBuf = await req.arrayBuffer();
    buffer = Buffer.from(arrayBuf);
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer el cuerpo de la solicitud." },
      { status: 400 }
    );
  }
  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: "La imagen está vacía." }, { status: 400 });
  }

  try {
    const result = await scanDocument(buffer, mediaType);
    return NextResponse.json(result);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/scan]", err);

    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY inválida o ausente." },
        { status: 500 }
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Límite de tasa de la API alcanzado. Probá de nuevo en unos segundos." },
        { status: 429 }
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Error de la API de Claude (${err.status}): ${err.message}` },
        { status: 502 }
      );
    }

    const message = err instanceof Error ? err.message : "Error desconocido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
