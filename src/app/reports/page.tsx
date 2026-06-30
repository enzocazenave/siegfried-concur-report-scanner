import { ReportsStatus } from "@/components/reports-status";
import { requireSessionForPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireSessionForPage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estado de informes</h1>
        <p className="text-sm text-muted-foreground">
          Quién entregó cada informe del año, por equipo. Filtrá por equipo y
          año.
        </p>
      </div>
      <ReportsStatus />
    </div>
  );
}
