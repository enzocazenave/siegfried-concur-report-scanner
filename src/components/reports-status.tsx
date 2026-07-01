"use client";

import * as React from "react";
import { Check, Clock, Minus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TeamCombobox } from "@/components/team-combobox";
import { cn } from "@/lib/utils";

type CellStatus = "missing" | "scanned" | "sent";

type Row = {
  employeeId: string;
  employeeName: string;
  team: string;
  months: Record<string, CellStatus>;
};

type Data = {
  teams: string[];
  years: number[];
  team: string;
  year: number;
  employees: Row[];
};

const MONTHS: [string, string][] = [
  ["01", "Ene"],
  ["02", "Feb"],
  ["03", "Mar"],
  ["04", "Abr"],
  ["05", "May"],
  ["06", "Jun"],
  ["07", "Jul"],
  ["08", "Ago"],
  ["09", "Sep"],
  ["10", "Oct"],
  ["11", "Nov"],
  ["12", "Dic"],
];

export function ReportsStatus() {
  const [data, setData] = React.useState<Data | null>(null);
  const [team, setTeam] = React.useState<string>("");
  const [year, setYear] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(
    async (teamArg: string | null, yearArg: number | null) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (teamArg) params.set("team", teamArg);
        if (yearArg) params.set("year", String(yearArg));
        const res = await fetch(`/api/reports/status?${params.toString()}`);
        if (!res.ok) throw new Error("No se pudo cargar el estado de informes.");
        const json = (await res.json()) as Data;
        setData(json);
        // Adoptamos la selección efectiva que resolvió el servidor.
        setTeam(json.team);
        setYear(json.year);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    load(null, null);
  }, [load]);

  function selectTeam(value: string) {
    setTeam(value);
    // Recargamos solo cuando el valor coincide exactamente con un equipo real
    // (mientras se tipea para buscar, no disparamos requests).
    if (data?.teams.includes(value)) load(value, year);
  }

  const employees = React.useMemo(() => data?.employees ?? [], [data]);

  // Resumen del equipo-año.
  const summary = React.useMemo(() => {
    let sent = 0;
    let scanned = 0;
    let missing = 0;
    for (const e of employees) {
      for (const [, st] of Object.entries(e.months)) {
        if (st === "sent") sent++;
        else if (st === "scanned") scanned++;
        else missing++;
      }
    }
    return { sent, scanned, missing };
  }, [employees]);

  // Agrupamos por equipo (ya vienen ordenados por equipo desde el server).
  const groups = React.useMemo(() => {
    const out: { team: string; rows: Row[]; missing: number }[] = [];
    let current: { team: string; rows: Row[]; missing: number } | null = null;
    for (const e of employees) {
      if (!current || current.team !== e.team) {
        current = { team: e.team, rows: [], missing: 0 };
        out.push(current);
      }
      current.rows.push(e);
      current.missing += Object.values(e.months).filter(
        (s) => s === "missing"
      ).length;
    }
    return out;
  }, [employees]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full max-w-xs space-y-1.5">
              <Label htmlFor="team-filter">Equipo</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <TeamCombobox
                    id="team-filter"
                    value={team}
                    onChange={selectTeam}
                    teams={data?.teams ?? []}
                    placeholder="Todos los equipos"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => load("", year)}
                  disabled={!team}
                  title="Ver todos los equipos"
                >
                  Todos
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Año</Label>
              <div className="flex flex-wrap gap-1.5">
                {(data?.years ?? []).map((y) => (
                  <Button
                    key={y}
                    variant={y === year ? "default" : "outline"}
                    size="sm"
                    onClick={() => load(team, y)}
                  >
                    {y}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-green-600/10 px-2.5 py-1 font-medium text-green-700 dark:text-green-400">
              <Check className="h-3.5 w-3.5" />
              {summary.sent} enviados
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-amber-500/15 px-2.5 py-1 font-medium text-amber-700 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5" />
              {summary.scanned} escaneados sin enviar
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted px-2.5 py-1 font-medium text-muted-foreground">
              <Minus className="h-3.5 w-3.5" />
              {summary.missing} faltantes
            </span>
          </div>

          <div className="max-h-[70vh] overflow-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="sticky left-0 top-0 z-30 bg-muted px-3 py-2 text-left font-medium">
                    Empleado
                  </th>
                  {MONTHS.map(([num, label]) => (
                    <th
                      key={num}
                      className="sticky top-0 z-20 w-12 bg-muted px-1 py-2 text-center font-medium text-muted-foreground"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={MONTHS.length + 1}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Cargando…
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={MONTHS.length + 1}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {data && data.teams.length === 0
                        ? "No hay empleados cargados en el padrón."
                        : "Este equipo no tiene empleados."}
                    </td>
                  </tr>
                ) : (
                  groups.map((g) => (
                    <React.Fragment key={g.team}>
                      <tr className="border-b bg-muted/60">
                        <td
                          colSpan={MONTHS.length + 1}
                          className="sticky left-0 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {g.team}
                          <span className="ml-2 font-normal normal-case">
                            · {g.rows.length}{" "}
                            {g.rows.length === 1 ? "empleado" : "empleados"}
                            {g.missing > 0 && ` · ${g.missing} faltantes`}
                          </span>
                        </td>
                      </tr>
                      {g.rows.map((e) => (
                        <tr
                          key={e.employeeId}
                          className="border-b last:border-0"
                        >
                          <td className="sticky left-0 z-10 bg-background px-3 py-1.5 font-medium">
                            {e.employeeName}
                          </td>
                          {MONTHS.map(([num]) => (
                            <td key={num} className="px-1 py-1.5 text-center">
                              <StatusCell status={e.months[num]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            🟢 Enviado · 🟡 Escaneado (sin enviar) · ⬜ Falta. Cada columna es el
            informe de ese mes (formato MM/AAAA).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCell({ status }: { status: CellStatus }) {
  if (status === "sent") {
    return (
      <span
        title="Enviado"
        className="mx-auto flex h-6 w-6 items-center justify-center rounded-md bg-green-600/15 text-green-700 dark:text-green-400"
      >
        <Check className="h-4 w-4" />
      </span>
    );
  }
  if (status === "scanned") {
    return (
      <span
        title="Escaneado (sin enviar)"
        className="mx-auto flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-400"
      >
        <Clock className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span
      title="Falta"
      className={cn(
        "mx-auto flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground"
      )}
    >
      <Minus className="h-4 w-4" />
    </span>
  );
}
