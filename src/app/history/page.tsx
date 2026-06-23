import { HistoryTable } from "@/components/history-table";
import { requireSessionForPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await requireSessionForPage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historial</h1>
        <p className="text-sm text-muted-foreground">
          Escaneos guardados. Buscá, filtrá por fecha y exportá a Excel.
        </p>
      </div>
      <HistoryTable isMaster={session.isMaster} />
    </div>
  );
}
