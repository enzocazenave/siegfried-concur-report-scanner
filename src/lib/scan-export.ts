import * as XLSX from "xlsx";

/** Subconjunto de campos de un Scan que aparecen en el Excel exportado. */
export type ExportScan = {
  scanDate: Date;
  reportName: string;
  employeeName: string | null;
  employeeId: string;
  sentAt: Date | null;
};

function formatExcelDate(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Construye el buffer .xlsx de un listado de escaneos. Lo usan tanto la
 * exportación normal (/api/scans/export) como el envío (/api/scans/send),
 * de modo que ambos archivos tienen exactamente las mismas columnas.
 *
 * NOTA: el Excel OMITE a propósito el usuario que escaneó cada fila.
 */
export function buildScansExcelBuffer(scans: ExportScan[]): Uint8Array {
  const rows = scans.map((s) => ({
    "Fecha de escaneo": formatExcelDate(s.scanDate),
    "Nombre del informe": s.reportName,
    "Nombre del empleado": s.employeeName ?? "",
    "Identificador de empleado": s.employeeId,
    "Fecha de envío": s.sentAt ? formatExcelDate(s.sentAt) : "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 22 },
    { wch: 22 },
    { wch: 28 },
    { wch: 28 },
    { wch: 22 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Escaneos");

  // XLSX.write con type:"buffer" devuelve un Buffer de Node; lo envolvemos en
  // un Uint8Array plano para que sea un BodyInit válido para NextResponse.
  return new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}
