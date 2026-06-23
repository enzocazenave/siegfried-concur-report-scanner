/**
 * Browser-side OCR client. Captures a JPEG snapshot from the live video and
 * POSTs it to /api/scan, which calls Claude Vision and returns the two
 * extracted fields. No alignment / guide / region logic on this side —
 * Claude reads the document directly.
 */

export type FieldConfidence = "high" | "medium" | "low";
export type FieldExtraction = {
  value: string | null;
  confidence: FieldConfidence;
};
export type OcrResult = {
  reportName: FieldExtraction;
  employeeName: FieldExtraction;
  employeeId: FieldExtraction;
};

// La cámara puede capturar hasta 4K (3840×2160). Subir ese JPEG completo
// (1–3 MB) domina la latencia del escaneo en producción, sobre todo desde un
// celular con datos móviles. Lo reescalamos al vuelo: el lado largo no supera
// MAX_EDGE px y la calidad baja a 0.8. El archivo cae a ~200–400 KB y Claude
// Vision lo lee igual (internamente reescala de todos modos).
const MAX_EDGE = 1600;

/** Capture the full video frame as a downscaled JPEG blob. */
export function captureFrameJpeg(
  video: HTMLVideoElement,
  quality = 0.8
): Promise<Blob> {
  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  // Factor de escala: 1 si ya entra dentro de MAX_EDGE (nunca agrandamos).
  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(srcW * scale);
  canvas.height = Math.round(srcH * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo codificar el JPEG."))),
      "image/jpeg",
      quality
    );
  });
}

export async function scanVideo(video: HTMLVideoElement): Promise<OcrResult> {
  const blob = await captureFrameJpeg(video);
  const res = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as OcrResult;
}
