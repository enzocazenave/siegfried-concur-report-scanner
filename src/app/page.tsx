import { Scanner } from "@/components/scanner";
import { requireSessionForPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireSessionForPage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Escanear informe</h1>
        <p className="text-sm text-muted-foreground">
          Colocá la hoja frente a la webcam y presioná <strong>Escanear</strong>.
        </p>
      </div>
      <Scanner />
    </div>
  );
}
