"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TeamCombobox } from "@/components/team-combobox";
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
import { cn } from "@/lib/utils";

type Employee = {
  id: number;
  employeeId: string;
  employeeName: string;
  team: string;
  createdAt: string;
  updatedAt: string;
};

type Page = {
  items: Employee[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const EMPLOYEE_ID_RE = /^99000\d{5}$/;

export function EmployeesAdmin() {
  const [data, setData] = React.useState<Page | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [teams, setTeams] = React.useState<string[]>([]);

  // Alta
  const [newId, setNewId] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [newTeam, setNewTeam] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  // Edición / borrado
  const [pendingEdit, setPendingEdit] = React.useState<Employee | null>(null);
  const [editId, setEditId] = React.useState("");
  const [editName, setEditName] = React.useState("");
  const [editTeam, setEditTeam] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<Employee | null>(
    null
  );
  const [deletingId, setDeletingId] = React.useState<number | null>(null);

  const fetchPage = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      params.set("page", String(page));
      params.set("pageSize", "15");
      const res = await fetch(`/api/admin/employees?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudo cargar el padrón.");
      setData((await res.json()) as Page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  const fetchTeams = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/teams");
      if (!res.ok) return;
      const body = (await res.json()) as { teams: string[] };
      setTeams(body.teams);
    } catch {
      /* non-blocking */
    }
  }, []);

  React.useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  React.useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Reset a página 1 cuando cambia la búsqueda.
  React.useEffect(() => {
    setPage(1);
  }, [query]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const id = newId.trim();
    const name = newName.trim();
    const team = newTeam.trim();
    if (!EMPLOYEE_ID_RE.test(id)) {
      toast.error("El código debe empezar con 99000 y tener 10 dígitos.");
      return;
    }
    if (!name || !team) {
      toast.error("Completá nombre y equipo.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: id, employeeName: name, team }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "No se pudo crear el empleado.");
      }
      toast.success("Empleado creado.");
      setNewId("");
      setNewName("");
      setNewTeam("");
      await Promise.all([fetchPage(), fetchTeams()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(emp: Employee) {
    setEditId(emp.employeeId);
    setEditName(emp.employeeName);
    setEditTeam(emp.team);
    setPendingEdit(emp);
  }

  async function confirmEdit() {
    const emp = pendingEdit;
    if (!emp) return;
    const id = editId.trim();
    const name = editName.trim();
    const team = editTeam.trim();
    if (!EMPLOYEE_ID_RE.test(id) || !name || !team) {
      toast.error("Revisá los datos: código 99000+5 dígitos, nombre y equipo.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: id, employeeName: name, team }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "No se pudo actualizar el empleado.");
      }
      toast.success("Empleado actualizado.");
      setPendingEdit(null);
      await Promise.all([fetchPage(), fetchTeams()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    const emp = pendingDelete;
    if (!emp) return;
    setDeletingId(emp.id);
    try {
      const res = await fetch(`/api/admin/employees/${emp.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "No se pudo eliminar el empleado.");
      }
      toast.success("Empleado eliminado.");
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

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            Agregar empleado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleCreate}
            className="grid gap-3 sm:grid-cols-[180px_1fr_1fr_auto] sm:items-end"
          >
            <div className="space-y-1.5">
              <Label htmlFor="new-id">Código</Label>
              <Input
                id="new-id"
                value={newId}
                inputMode="numeric"
                onChange={(e) => setNewId(e.target.value.replace(/\D/g, ""))}
                placeholder="9900060000"
                className="font-mono"
                maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Nombre del empleado</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="APELLIDO, NOMBRE"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-team">Equipo</Label>
              <TeamCombobox
                id="new-team"
                value={newTeam}
                onChange={setNewTeam}
                teams={teams}
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Agregar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Padrón de empleados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, código o equipo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          <div
            className={cn(
              "rounded-md border transition-opacity",
              loading && items.length > 0 && "pointer-events-none opacity-60"
            )}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Código</TableHead>
                  <TableHead>Nombre del empleado</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {loading ? "Cargando…" : "Sin resultados."}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-mono text-sm">
                        {emp.employeeId}
                      </TableCell>
                      <TableCell>{emp.employeeName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {emp.team}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(emp)}
                            aria-label="Editar"
                            title="Editar"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPendingDelete(emp)}
                            disabled={deletingId === emp.id}
                            aria-label="Eliminar"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            {deletingId === emp.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="text-muted-foreground">
              {total} {total === 1 ? "empleado" : "empleados"}
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
      </Card>

      <AlertDialog
        open={pendingEdit !== null}
        onOpenChange={(open) => {
          if (!open && savingEdit) return;
          if (!open) setPendingEdit(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar empleado</AlertDialogTitle>
            <AlertDialogDescription>
              Modificá los datos del empleado. El código debe empezar con 99000
              y tener 10 dígitos.
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
              <Label htmlFor="edit-id">Código</Label>
              <Input
                id="edit-id"
                value={editId}
                inputMode="numeric"
                onChange={(e) => setEditId(e.target.value.replace(/\D/g, ""))}
                className="font-mono"
                maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nombre del empleado</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-team">Equipo</Label>
              <TeamCombobox
                id="edit-team"
                value={editTeam}
                onChange={setEditTeam}
                teams={teams}
              />
            </div>
          </form>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingEdit}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmEdit();
              }}
              disabled={savingEdit}
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
          if (!open && deletingId !== null) return;
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este empleado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si lo eliminás, su código dejará
              de validar al escanear.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingDelete && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="grid grid-cols-[100px_1fr] gap-y-1">
                <div className="text-muted-foreground">Código</div>
                <div className="font-mono">{pendingDelete.employeeId}</div>
                <div className="text-muted-foreground">Nombre</div>
                <div>{pendingDelete.employeeName}</div>
                <div className="text-muted-foreground">Equipo</div>
                <div>{pendingDelete.team}</div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
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
    </div>
  );
}
