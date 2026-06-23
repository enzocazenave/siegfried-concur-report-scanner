import { UsersAdmin } from "@/components/users-admin";
import { requireMasterForPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  await requireMasterForPage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Gestión de usuarios. Solo accesible para el usuario maestro.
        </p>
      </div>
      <UsersAdmin />
    </div>
  );
}
