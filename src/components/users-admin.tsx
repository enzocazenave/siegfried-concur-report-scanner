"use client";

import * as React from "react";
import {
  KeyRound,
  Loader2,
  Plus,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDateTime } from "@/lib/utils";

type User = {
  id: number;
  username: string;
  isMaster: boolean;
  createdAt: string;
};

export function UsersAdmin() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newUsername, setNewUsername] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<User | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [pendingPwChange, setPendingPwChange] = React.useState<User | null>(
    null
  );
  const [pwNew, setPwNew] = React.useState("");
  const [changingPw, setChangingPw] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("No se pudo cargar la lista de usuarios.");
      const data = (await res.json()) as { users: User[] };
      setUsers(data.users);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
        }),
      });
      if (!res.ok) {
        let message = "No se pudo crear el usuario.";
        try {
          const body = await res.json();
          if (typeof body?.error === "string") message = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      toast.success("Usuario creado.");
      setNewUsername("");
      setNewPassword("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreating(false);
    }
  }

  async function confirmChangePassword() {
    const user = pendingPwChange;
    if (!user) return;
    if (pwNew.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setChangingPw(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwNew }),
      });
      if (!res.ok) {
        let message = "No se pudo cambiar la contraseña.";
        try {
          const body = await res.json();
          if (typeof body?.error === "string") message = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      toast.success(`Contraseña de ${user.username} actualizada.`);
      setPwNew("");
      setPendingPwChange(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setChangingPw(false);
    }
  }

  async function confirmDelete() {
    const user = pendingDelete;
    if (!user) return;
    setDeletingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        let message = "No se pudo eliminar el usuario.";
        try {
          const body = await res.json();
          if (typeof body?.error === "string") message = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      toast.success("Usuario eliminado.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            Crear usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleCreate}
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <div className="space-y-1.5">
              <Label htmlFor="new-username">Usuario</Label>
              <Input
                id="new-username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="ej. juana.perez"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Contraseña inicial</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="mínimo 6 caracteres"
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Crear
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios existentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="w-32">Rol</TableHead>
                  <TableHead className="w-72">Creado</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Sin usuarios.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-sm">
                        {u.username}
                      </TableCell>
                      <TableCell>
                        {u.isMaster ? (
                          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <Shield className="h-3 w-3" />
                            Maestro
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Operador
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {formatDateTime(u.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setPwNew("");
                              setPendingPwChange(u);
                            }}
                            aria-label="Cambiar contraseña"
                            title="Cambiar contraseña"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {!u.isMaster && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPendingDelete(u)}
                              disabled={deletingId === u.id}
                              aria-label="Eliminar"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              {deletingId === u.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingPwChange !== null}
        onOpenChange={(open) => {
          if (!open && changingPw) return;
          if (!open) {
            setPendingPwChange(null);
            setPwNew("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cambiar contraseña de &quot;{pendingPwChange?.username}&quot;
            </AlertDialogTitle>
            <AlertDialogDescription>
              La nueva contraseña reemplaza inmediatamente a la anterior. El
              usuario va a necesitar volver a iniciar sesión la próxima vez.
              Mínimo 6 caracteres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirmChangePassword();
            }}
            className="space-y-2"
          >
            <Label htmlFor="pw-new">Nueva contraseña</Label>
            <Input
              id="pw-new"
              type="password"
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              autoComplete="new-password"
              placeholder="mínimo 6 caracteres"
              minLength={6}
              required
              autoFocus
            />
          </form>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingPw}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmChangePassword();
              }}
              disabled={changingPw || pwNew.length < 6}
            >
              {changingPw ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
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
            <AlertDialogTitle>
              ¿Eliminar el usuario &quot;{pendingDelete?.username}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si el usuario tiene escaneos
              registrados, el sistema no permitirá eliminarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
