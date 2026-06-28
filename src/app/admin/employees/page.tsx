import { EmployeesAdmin } from "@/components/employees-admin";
import { requireMasterForPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EmployeesAdminPage() {
  await requireMasterForPage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Empleados</h1>
        <p className="text-sm text-muted-foreground">
          Padrón de empleados. Se usa para validar el identificador al escanear.
          Solo accesible para el usuario maestro.
        </p>
      </div>
      <EmployeesAdmin />
    </div>
  );
}
