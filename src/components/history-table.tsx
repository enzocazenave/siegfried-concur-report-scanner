"use client";

import * as React from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Download,
  Loader2,
  Pencil,
  Search,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/utils";

type Scan = {
  id: number;
  scanDate: string;
  reportName: string;
  employeeName: string | null;
  employeeId: string;
  team: string | null;
  sentAt: string | null;
  username: string;
};

type Page = {
  items: Scan[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type Stats = {
  total: number;
  sent: number;
  pending: number;
};

type RegistryEmployee = {
  employeeId: string;
  employeeName: string;
  team: string;
};

type EmployeeMatch =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "found"; employee: RegistryEmployee }
  | { status: "notfound" };

const REPORT_NAME_RE = /^(0[1-9]|1[0-2])\/\d{4}$/;
const EMPLOYEE_ID_RE = /^99000\d{5}$/;

export function HistoryTable({ isMaster }: { isMaster: boolean }) {
  // The visible input only holds the SUFFIX. The full search term sent to the
  // API is always "99000" + suffix (all Siegfried IDs start with that prefix).
  const EMPLOYEE_ID_PREFIX = "99000";
  const [employeeIdSuffix, setEmployeeIdSuffix] = React.useState("");
  const [reportName, setReportName] = React.useState("");
  const [employeeName, setEmployeeName] = React.useState("");
  const [team, setTeam] = React.useState("");
  // YYYY-MM-DD as typed in <input type="date">; empty string = unset.
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<Page | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Scan | null>(null);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [confirmSendOpen, setConfirmSendOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  // Edición (solo maestro).
  const [pendingEdit, setPendingEdit] = React.useState<Scan | null>(null);
  const [editReportName, setEditReportName] = React.useState("");
  const [editEmployeeId, setEditEmployeeId] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [editMatch, setEditMatch] = React.useState<EmployeeMatch>({
    status: "idle",
  });
  const pageSize = 10;

  // Valida el código del editor contra el padrón (con debounce).
  React.useEffect(() => {
    if (!pendingEdit) return;
    const id = editEmployeeId.trim();
    if (!EMPLOYEE_ID_RE.test(id)) {
      setEditMatch({ status: "idle" });
      return;
    }
    let cancelled = false;
    setEditMatch({ status: "checking" });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/employees/lookup?employeeId=${encodeURIComponent(id)}`
        );
        const body = await res.json();
        if (cancelled) return;
        setEditMatch(
          res.ok && body?.found
            ? { status: "found", employee: body.employee }
            : { status: "notfound" }
        );
      } catch {
        if (!cancelled) setEditMatch({ status: "notfound" });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [editEmployeeId, pendingEdit]);

  // Build the shared filter query params (used by both the list fetch and
  // the Excel export so the exported file matches exactly what's on screen).
  const buildFilterParams = React.useCallback(() => {
    const params = new URLSearchParams();
    const suffix = employeeIdSuffix.trim();
    if (suffix) {
      // Always prepend the fixed prefix so the filter matches real IDs.
      params.set("employeeId", `${EMPLOYEE_ID_PREFIX}${suffix}`);
    }
    if (reportName.trim()) params.set("reportName", reportName.trim());
    if (employeeName.trim()) params.set("employeeName", employeeName.trim());
    if (team.trim()) params.set("team", team.trim());
    if (fromDate) {
      // Local-TZ start of day.
      params.set("from", new Date(`${fromDate}T00:00:00`).toISOString());
    }
    if (toDate) {
      // Local-TZ end of day (inclusive).
      params.set("to", new Date(`${toDate}T23:59:59.999`).toISOString());
    }
    return params;
  }, [employeeIdSuffix, reportName, employeeName, team, fromDate, toDate]);

  const fetchPage = React.useCallback(async () => {
    setLoading(true);
    const params = buildFilterParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    try {
      const res = await fetch(`/api/scans?${params.toString()}`);
      if (!res.ok) throw new Error("Error al cargar el historial");
      const json = (await res.json()) as Page;
      setData(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [page, buildFilterParams]);

  // Stats are global (unaffected by filters): scanned / sent / pending.
  const fetchStats = React.useCallback(async () => {
    try {
      const res = await fetch("/api/scans/stats");
      if (!res.ok) return;
      setStats((await res.json()) as Stats);
    } catch {
      /* non-blocking */
    }
  }, []);

  React.useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  React.useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset page when filters change.
  React.useEffect(() => {
    setPage(1);
  }, [employeeIdSuffix, reportName, employeeName, team, fromDate, toDate]);

  function clearAllFilters() {
    setEmployeeIdSuffix("");
    setReportName("");
    setEmployeeName("");
    setTeam("");
    setFromDate("");
    setToDate("");
  }

  const hasActiveFilters =
    !!employeeIdSuffix.trim() ||
    !!reportName.trim() ||
    !!employeeName.trim() ||
    !!team.trim() ||
    !!fromDate ||
    !!toDate;

  function openEdit(scan: Scan) {
    setEditReportName(scan.reportName);
    setEditEmployeeId(scan.employeeId);
    setEditMatch({ status: "idle" });
    setPendingEdit(scan);
  }

  const editReportNameValid = REPORT_NAME_RE.test(editReportName.trim());
  const editEmployeeIdValid = EMPLOYEE_ID_RE.test(editEmployeeId.trim());
  const editValid =
    editReportNameValid &&
    editEmployeeIdValid &&
    editMatch.status === "found";

  async function confirmEdit() {
    const scan = pendingEdit;
    if (!scan || !editValid) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/scans/${scan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportName: editReportName.trim(),
          employeeId: editEmployeeId.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "No se pudo actualizar el escaneo.");
      }
      toast.success("Escaneo actualizado.");
      setPendingEdit(null);
      await fetchPage();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    const scan = pendingDelete;
    if (!scan) return;
    setDeletingId(scan.id);
    try {
      const res = await fetch(`/api/scans/${scan.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        let message = "No se pudo eliminar el escaneo.";
        try {
          const body = await res.json();
          if (typeof body?.error === "string") message = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      toast.success("Escaneo eliminado.");
      void fetchStats();
      // If we just emptied the current page (except the last), step back one.
      if (data && data.items.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        await fetchPage();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  function handleExport() {
    const params = buildFilterParams();
    const url = `/api/scans/export${params.toString() ? `?${params}` : ""}`;
    window.location.href = url;
  }

  // "Enviar": marks all pending reports as sent and downloads the Excel with
  // exactly those reports. Global operation — ignores the on-screen filters.
  async function confirmSend() {
    setSending(true);
    try {
      const res = await fetch("/api/scans/send", { method: "POST" });
      if (!res.ok) {
        let message = "No se pudieron enviar los informes.";
        try {
          const body = await res.json();
          if (typeof body?.error === "string") message = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }

      const sentCount = Number(res.headers.get("X-Sent-Count") ?? 0);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+?)"/);
      a.download = match?.[1] ?? "informes-enviados.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success(
        `${sentCount} ${
          sentCount === 1 ? "informe enviado" : "informes enviados"
        }.`
      );
      setConfirmSendOpen(false);
      await Promise.all([fetchPage(), fetchStats()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSending(false);
    }
  }

  const pendingCount = stats?.pending ?? 0;

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-2xl font-bold tabular-nums">
              {stats ? stats.total : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              Informes escaneados
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-2xl font-bold tabular-nums">
              {stats ? stats.sent : "—"}
            </div>
            <div className="text-xs text-muted-foreground">Enviados</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-2xl font-bold tabular-nums">
              {stats ? stats.pending : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              Pendientes de enviar
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-stretch">
            <span className="flex select-none items-center rounded-l-md border border-r-0 border-input bg-muted px-3 font-mono text-sm text-muted-foreground">
              {EMPLOYEE_ID_PREFIX}
            </span>
            <Input
              placeholder="resto del identificador…"
              value={employeeIdSuffix}
              inputMode="numeric"
              pattern="[0-9]*"
              onChange={(e) =>
                setEmployeeIdSuffix(e.target.value.replace(/\D/g, ""))
              }
              className="rounded-l-none font-mono"
              aria-label={`Buscar por identificador de empleado (empieza con ${EMPLOYEE_ID_PREFIX})`}
            />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre del informe…"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre del empleado…"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por equipo…"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="from-date"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Desde
            </label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-[170px]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="to-date"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Hasta
            </label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="w-[170px]"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const today = new Date();
              const ymd = `${today.getFullYear()}-${String(
                today.getMonth() + 1
              ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
              setFromDate(ymd);
              setToDate(ymd);
            }}
          >
            Hoy
          </Button>

          {/* Spacer pushes the action buttons to the right */}
          <div className="ml-auto flex flex-wrap items-end gap-2">
            <Button
              variant="outline"
              onClick={clearAllFilters}
              disabled={!hasActiveFilters}
              className="min-w-[150px]"
            >
              <X className="h-4 w-4" />
              Limpiar filtros
            </Button>
            <Button onClick={handleExport} className="min-w-[150px]">
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
            <Button
              onClick={() => setConfirmSendOpen(true)}
              disabled={pendingCount === 0 || sending}
              className="min-w-[150px]"
            >
              <Send className="h-4 w-4" />
              Enviar
              {pendingCount > 0 ? ` (${pendingCount})` : ""}
            </Button>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha de escaneo</TableHead>
                <TableHead>Nombre del informe</TableHead>
                <TableHead>Nombre del empleado</TableHead>
                <TableHead>Identificador de empleado</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Fecha de envío</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Sin resultados.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell className="font-mono text-xs">
                      {formatDate(scan.scanDate)}
                    </TableCell>
                    <TableCell>{scan.reportName}</TableCell>
                    <TableCell>
                      {scan.employeeName ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      {scan.employeeId}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {scan.team ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {scan.sentAt ? (
                        formatDate(scan.sentAt)
                      ) : (
                        <span className="text-muted-foreground">
                          Sin enviar
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {scan.username}
                    </TableCell>
                    <TableCell className="text-right">
                      {isMaster && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(scan)}
                            aria-label="Editar"
                            title="Editar"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPendingDelete(scan)}
                            disabled={deletingId === scan.id}
                            aria-label="Eliminar"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            {deletingId === scan.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="text-muted-foreground">
            {total} {total === 1 ? "registro" : "registros"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="px-2">
              Página {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>

      <AlertDialog
        open={pendingEdit !== null}
        onOpenChange={(open) => {
          if (!open && savingEdit) return;
          if (!open) setPendingEdit(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar escaneo</AlertDialogTitle>
            <AlertDialogDescription>
              Corregí el período o el identificador. El nombre y el equipo se
              toman del padrón según el código.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirmEdit();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="edit-report-name">Nombre del informe</Label>
              <Input
                id="edit-report-name"
                value={editReportName}
                onChange={(e) => setEditReportName(e.target.value)}
                placeholder="MM/YYYY (ej. 03/2026)"
                className={
                  editReportName && !editReportNameValid
                    ? "border-destructive focus-visible:ring-destructive"
                    : undefined
                }
              />
              {editReportName && !editReportNameValid && (
                <p className="text-xs text-destructive">
                  Debe tener el formato MM/YYYY (ej. 03/2026).
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-employee-id">Identificador de empleado</Label>
              <Input
                id="edit-employee-id"
                value={editEmployeeId}
                inputMode="numeric"
                onChange={(e) =>
                  setEditEmployeeId(e.target.value.replace(/\D/g, ""))
                }
                className="font-mono"
                maxLength={10}
              />
              {editEmployeeId && !editEmployeeIdValid && (
                <p className="text-xs text-destructive">
                  Debe empezar con 99000 y tener 10 dígitos en total.
                </p>
              )}
              {editEmployeeIdValid && editMatch.status === "checking" && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Verificando en el padrón…
                </p>
              )}
              {editEmployeeIdValid && editMatch.status === "notfound" && (
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Este código no corresponde a ningún empleado del padrón.
                </p>
              )}
              {editMatch.status === "found" && (
                <p className="flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {editMatch.employee.employeeName} — {editMatch.employee.team}
                  </span>
                </p>
              )}
            </div>
          </form>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingEdit}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmEdit();
              }}
              disabled={savingEdit || !editValid}
            >
              {savingEdit ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" />
                  Guardar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          // Block closing while a delete is in flight.
          if (!open && deletingId !== null) return;
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este escaneo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingDelete && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="grid grid-cols-[140px_1fr] gap-y-1">
                <div className="text-muted-foreground">Fecha de escaneo</div>
                <div className="font-mono text-xs">
                  {formatDate(pendingDelete.scanDate)}
                </div>
                <div className="text-muted-foreground">Nombre del informe</div>
                <div>{pendingDelete.reportName}</div>
                <div className="text-muted-foreground">
                  Identificador de empleado
                </div>
                <div className="font-mono">{pendingDelete.employeeId}</div>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog open while the request is in flight; we
                // close it manually in `confirmDelete`'s finally block.
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId !== null ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Eliminando…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmSendOpen}
        onOpenChange={(open) => {
          // Block closing while a send is in flight.
          if (!open && sending) return;
          setConfirmSendOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Estás seguro que querés enviar {pendingCount}{" "}
              {pendingCount === 1 ? "informe" : "informes"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se descargará un Excel con los informes pendientes y quedarán
              marcados con la fecha de envío de hoy.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmSend();
              }}
              disabled={sending}
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
