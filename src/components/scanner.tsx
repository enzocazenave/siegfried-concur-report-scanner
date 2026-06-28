"use client";

import * as React from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Save,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  scanVideo,
  type FieldConfidence,
  type OcrResult,
} from "@/lib/ocr";
import { formatDate } from "@/lib/utils";

type Phase = "idle" | "scanning" | "review";

// Reglas de validación de los campos antes de poder confirmar:
//  - Nombre del informe: período MM/YYYY (mes 01–12, año de 4 dígitos).
//  - Nombre del empleado: cualquier texto no vacío.
//  - Identificador: empieza con 99000 y le siguen 5 dígitos (10 en total).
const REPORT_NAME_RE = /^(0[1-9]|1[0-2])\/\d{4}$/;
const EMPLOYEE_ID_RE = /^99000\d{5}$/;

function isReportNameValid(v: string): boolean {
  return REPORT_NAME_RE.test(v.trim());
}
function isEmployeeNameValid(v: string): boolean {
  return v.trim().length > 0;
}
function isEmployeeIdValid(v: string): boolean {
  return EMPLOYEE_ID_RE.test(v.trim());
}

type DuplicateInfo = {
  id: number;
  scanDate: string;
  reportName: string;
  employeeName: string | null;
  employeeId: string;
  username: string;
};

export function Scanner() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [reportName, setReportName] = React.useState("");
  const [employeeName, setEmployeeName] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<OcrResult | null>(null);
  const [duplicate, setDuplicate] = React.useState<DuplicateInfo | null>(null);

  React.useEffect(() => {
    let active = true;

    function stopStream() {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    async function acquire(attempt = 0): Promise<void> {
      try {
        stopStream();
        const videoConstraints = {
          width: { ideal: 3840 },
          height: { ideal: 2160 },
          facingMode: "environment",
          advanced: [
            { focusMode: "continuous" },
            { exposureMode: "continuous" },
            { whiteBalanceMode: "continuous" },
          ],
        } as unknown as MediaTrackConstraints;
        const s = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        setCameraError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        if (!active) return;
        const name = err instanceof DOMException ? err.name : "";
        const busy =
          name === "NotReadableError" ||
          name === "AbortError" ||
          name === "TrackStartError";
        if (busy && attempt < 8) {
          await new Promise((r) => setTimeout(r, 300 + attempt * 200));
          if (!active) return;
          return acquire(attempt + 1);
        }
        setCameraError(
          err instanceof Error ? err.message : "No se pudo acceder a la cámara"
        );
      }
    }

    acquire();
    window.addEventListener("pagehide", stopStream);
    window.addEventListener("beforeunload", stopStream);
    return () => {
      active = false;
      window.removeEventListener("pagehide", stopStream);
      window.removeEventListener("beforeunload", stopStream);
      stopStream();
    };
  }, []);

  async function handleScan() {
    if (!videoRef.current) return;
    setPhase("scanning");
    try {
      const res = await scanVideo(videoRef.current);
      setResult(res);
      // Low-confidence reads are auto-cleared: the user MUST re-scan or type
      // them manually. This prevents the "5/2026 leído como 8/2026" case
      // where Claude was confident but visually similar digits got swapped.
      setReportName(
        res.reportName.confidence === "low"
          ? ""
          : res.reportName.value ?? ""
      );
      setEmployeeName(
        res.employeeName.confidence === "low"
          ? ""
          : res.employeeName.value ?? ""
      );
      setEmployeeId(
        res.employeeId.confidence === "low"
          ? ""
          : res.employeeId.value ?? ""
      );
      setPhase("review");

      const lowFields: string[] = [];
      const medFields: string[] = [];
      if (res.reportName.confidence === "low" || !res.reportName.value)
        lowFields.push("Nombre del informe");
      else if (res.reportName.confidence === "medium")
        medFields.push("Nombre del informe");
      if (res.employeeName.confidence === "low" || !res.employeeName.value)
        lowFields.push("Nombre del empleado");
      else if (res.employeeName.confidence === "medium")
        medFields.push("Nombre del empleado");
      if (res.employeeId.confidence === "low" || !res.employeeId.value)
        lowFields.push("Identificador de empleado");
      else if (res.employeeId.confidence === "medium")
        medFields.push("Identificador de empleado");

      if (lowFields.length > 0) {
        toast.error(
          `Confianza baja en: ${lowFields.join(", ")}. Volvé a escanear o cargá a mano.`,
          { duration: 6000 }
        );
      } else if (medFields.length > 0) {
        toast.warning(
          `Verificá manualmente: ${medFields.join(", ")} (algunos dígitos podrían confundirse).`,
          { duration: 6000 }
        );
      } else {
        toast.success("Datos extraídos con alta confianza. Verificá y confirmá.");
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Falló el escaneo. Intentá de nuevo."
      );
      setPhase("idle");
    }
  }

  async function handleRescan() {
    setResult(null);
    setReportName("");
    setEmployeeName("");
    setEmployeeId("");
    setPhase("idle");
    // Pequeño delay para que el botón quede deshabilitado mientras
    // React reconcilia, evita doble-click accidental.
    await new Promise((r) => setTimeout(r, 50));
    await handleScan();
  }

  async function postScan(): Promise<{
    ok: boolean;
    duplicate?: DuplicateInfo;
    error?: string;
  }> {
    const res = await fetch("/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportName: reportName.trim(),
        employeeName: employeeName.trim() || null,
        employeeId: employeeId.trim(),
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    if (res.status === 409 && body?.existing) {
      return { ok: false, duplicate: body.existing as DuplicateInfo };
    }
    return {
      ok: false,
      error: typeof body?.error === "string" ? body.error : "Error al guardar",
    };
  }

  const reportNameValid = isReportNameValid(reportName);
  const employeeNameValid = isEmployeeNameValid(employeeName);
  const employeeIdValid = isEmployeeIdValid(employeeId);
  const formValid = reportNameValid && employeeNameValid && employeeIdValid;

  async function handleConfirm() {
    if (!formValid) {
      toast.error("Revisá los campos: hay datos que no cumplen el formato.");
      return;
    }
    setSaving(true);
    try {
      const r = await postScan();
      if (r.ok) {
        toast.success("Escaneo guardado correctamente.");
        handleCancel();
        return;
      }
      if (r.duplicate) {
        // Duplicates are NEVER saved. Show the informational modal and reset
        // the scanner in the background so closing the modal leaves the UI
        // ready for the next scan.
        const dup = r.duplicate;
        handleCancel();
        setDuplicate(dup);
        return;
      }
      throw new Error(r.error ?? "Error al guardar");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo guardar el escaneo."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setReportName("");
    setEmployeeName("");
    setEmployeeId("");
    setResult(null);
    setDuplicate(null);
    setPhase("idle");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <Card>
        <CardHeader>
          <CardTitle>Webcam</CardTitle>
        </CardHeader>
        <CardContent>
          {cameraError ? (
            <div className="flex h-[480px] items-center justify-center rounded-md border border-dashed bg-muted/40 p-6 text-center text-sm text-destructive">
              {cameraError}
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-md border bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-video w-full object-contain"
              />
              {phase === "scanning" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <div className="text-sm">Analizando con Claude…</div>
                </div>
              )}
            </div>
          )}

          <p className="mt-2 text-xs text-muted-foreground">
            Apoyá la hoja frente a la cámara y presioná Escanear. No hace falta
            encuadrar.
          </p>

          <div className="mt-4 flex gap-3">
            <Button
              size="lg"
              onClick={handleScan}
              disabled={phase !== "idle" || !!cameraError}
              className="flex-1"
            >
              <Camera className="h-4 w-4" />
              Escanear
            </Button>
            {phase === "review" && (
              <Button
                variant="outline"
                size="lg"
                onClick={handleCancel}
                disabled={saving}
              >
                <RefreshCcw className="h-4 w-4" />
                Nuevo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultado</CardTitle>
        </CardHeader>
        <CardContent>
          {phase !== "review" ? (
            <p className="text-sm text-muted-foreground">
              Presioná <strong>Escanear</strong> para extraer los datos del
              informe.
            </p>
          ) : (
            <div className="space-y-5">
              <FieldWithConfidence
                id="reportName"
                label="Nombre del informe"
                value={reportName}
                onChange={setReportName}
                confidence={result?.reportName.confidence}
                fieldEmpty={!reportName}
                error={
                  reportNameValid
                    ? null
                    : "Debe tener el formato MM/YYYY (ej. 03/2026)."
                }
              />

              <FieldWithConfidence
                id="employeeName"
                label="Nombre del empleado"
                value={employeeName}
                onChange={setEmployeeName}
                confidence={result?.employeeName.confidence}
                fieldEmpty={!employeeName}
                error={
                  employeeNameValid ? null : "El nombre no puede estar vacío."
                }
              />

              <FieldWithConfidence
                id="employeeId"
                label="Identificador de empleado"
                value={employeeId}
                onChange={setEmployeeId}
                confidence={result?.employeeId.confidence}
                fieldEmpty={!employeeId}
                error={
                  employeeIdValid
                    ? null
                    : "Debe empezar con 99000 y tener 10 dígitos en total."
                }
              />

              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1"
                  onClick={handleConfirm}
                  disabled={saving || !formValid}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Confirmar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRescan}
                  disabled={saving}
                  title="Volver a escanear con la cámara"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Re-escanear
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={duplicate !== null}
        onOpenChange={(open) => {
          if (!open) setDuplicate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Este informe ya fue cargado
            </AlertDialogTitle>
            <AlertDialogDescription>
              No se puede registrar el mismo informe dos veces. El escaneo ya
              existente es:
            </AlertDialogDescription>
          </AlertDialogHeader>

          {duplicate && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="grid grid-cols-[140px_1fr] gap-y-1">
                <div className="text-muted-foreground">Fecha de escaneo</div>
                <div className="font-mono text-xs">
                  {formatDate(duplicate.scanDate)}
                </div>
                <div className="text-muted-foreground">Nombre del informe</div>
                <div>{duplicate.reportName}</div>
                <div className="text-muted-foreground">Nombre del empleado</div>
                <div>
                  {duplicate.employeeName ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="text-muted-foreground">
                  Identificador de empleado
                </div>
                <div className="font-mono">{duplicate.employeeId}</div>
                <div className="text-muted-foreground">Cargado por</div>
                <div className="font-mono text-xs">{duplicate.username}</div>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDuplicate(null)}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FieldWithConfidence({
  id,
  label,
  value,
  onChange,
  confidence,
  fieldEmpty,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  confidence: FieldConfidence | undefined;
  fieldEmpty: boolean;
  // Mensaje de validación de formato; null si el campo es válido.
  error?: string | null;
}) {
  // Visual contract:
  //   high   → green badge, default input style
  //   medium → yellow badge ("verificar"), amber border
  //   low    → red badge ("re-escaneá / cargá a mano"), red border + empty input
  //   undefined → no badge (haven't scanned yet)
  let badge: React.ReactNode = null;
  let inputClass: string | undefined;

  if (confidence === "high") {
    badge = (
      <span className="inline-flex items-center gap-1 rounded bg-green-600/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        Alta confianza
      </span>
    );
  } else if (confidence === "medium") {
    badge = (
      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        Verificá manualmente
      </span>
    );
    inputClass = "border-amber-500 focus-visible:ring-amber-500";
  } else if (confidence === "low") {
    badge = (
      <span className="inline-flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
        <XCircle className="h-3 w-3" />
        Confianza baja — re-escaneá o cargá a mano
      </span>
    );
    inputClass = "border-destructive focus-visible:ring-destructive";
  }
  if (fieldEmpty && confidence !== "high") {
    // Reinforce empty-state with red border so the user can't miss it.
    inputClass = "border-destructive focus-visible:ring-destructive";
  }
  if (error) {
    // Formato inválido: el borde rojo manda por sobre el de confianza.
    inputClass = "border-destructive focus-visible:ring-destructive";
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {badge}
      </div>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          confidence === "low"
            ? "(re-escaneá o escribilo a mano)"
            : "(escribilo a mano)"
        }
        className={inputClass}
        aria-invalid={!!error}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
