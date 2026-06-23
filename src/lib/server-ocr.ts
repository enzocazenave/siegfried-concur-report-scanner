/**
 * Server-side OCR via Claude Vision.
 *
 *   Buffer (JPEG/PNG photo of the report)
 *     -> Anthropic SDK with structured-output JSON Schema
 *     -> { reportName: string | null, employeeId: string | null }
 *
 * The browser only captures and POSTs a photo. No OpenCV, Tesseract,
 * region coordinates, alignment guides, or sharpness meters. The employee
 * places the page in front of the camera and presses Escanear.
 */

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "Falta ANTHROPIC_API_KEY en el entorno. Definila en .env (mirá .env.example)."
    );
  }
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

export type FieldConfidence = "high" | "medium" | "low";
export type FieldExtraction = {
  value: string | null;
  confidence: FieldConfidence;
};
export type ServerOcrResult = {
  reportName: FieldExtraction;
  employeeName: FieldExtraction;
  employeeId: FieldExtraction;
};

// JSON Schema fed directly to Claude's structured-output channel. Each field
// is { value, confidence } so the UI can warn / reject low-confidence reads.
const REPORT_FIELDS_SCHEMA = {
  type: "object",
  properties: {
    reportName: {
      type: "object",
      properties: {
        value: {
          type: ["string", "null"],
          description:
            "Período del informe NORMALIZADO al formato MM/YYYY (ej. '03/2026'). El valor en la hoja puede aparecer escrito de varias formas — '03/2026', 'informe-gastos-03-2026', 'informe gastos 03/2026', 'gastos 03-2026', 'Marzo 2026', etc. — pero siempre devolvé solo la parte mes/año en formato MM/YYYY con la barra como separador y el mes a dos dígitos. null si no se lee con seguridad.",
        },
        confidence: {
          type: "string",
          enum: ["high", "medium", "low"],
          description:
            "Tu nivel de confianza al leer ESTE campo. high = sin ambigüedad. medium = lo leíste pero algún dígito podría confundirse (ej. 5/8, 3/8, 0/8, 1/7, 6/0). low = imagen borrosa, oscura, parcialmente cubierta, o no podés determinar mes/año con seguridad.",
        },
      },
      required: ["value", "confidence"],
      additionalProperties: false,
    },
    employeeName: {
      type: "object",
      properties: {
        value: {
          type: ["string", "null"],
          description:
            "Valor del campo 'Nombre del empleado', el nombre completo de la persona, tal cual está impreso (ej. 'MARIA HERNANDEZ'). Mantené la capitalización original — si está en mayúsculas, devolvelo en mayúsculas. null si no se lee con seguridad.",
        },
        confidence: {
          type: "string",
          enum: ["high", "medium", "low"],
          description:
            "Tu nivel de confianza al leer ESTE campo. high = todos los caracteres claros. medium = alguna letra podría confundirse o el apellido es ambiguo. low = imagen borrosa, oscura, parcialmente cubierta.",
        },
      },
      required: ["value", "confidence"],
      additionalProperties: false,
    },
    employeeId: {
      type: "object",
      properties: {
        value: {
          type: ["string", "null"],
          description:
            "Valor del campo 'Identificador de empleado', un número de aproximadamente 10 dígitos (ej. '9900060333'). null si no se lee con seguridad.",
        },
        confidence: {
          type: "string",
          enum: ["high", "medium", "low"],
          description:
            "Tu nivel de confianza al leer ESTE campo. high = sin ambigüedad. medium = lo leíste pero algún dígito podría confundirse (ej. 5/8, 3/8, 0/8, 1/7, 6/0). low = imagen borrosa, oscura, parcialmente cubierta.",
        },
      },
      required: ["value", "confidence"],
      additionalProperties: false,
    },
  },
  required: ["reportName", "employeeName", "employeeId"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Sos un asistente que extrae datos de informes de gastos impresos a partir de una foto.

Cada informe contiene siempre los mismos TRES campos relevantes con sus etiquetas en español:
- "Nombre del informe :"        seguido de un valor que SIEMPRE representa un período mes/año, pero puede aparecer escrito de varias formas:
                                  * "03/2026"
                                  * "informe-gastos-03-2026"
                                  * "informe gastos 03/2026"
                                  * "gastos 03-2026"
                                  * "Marzo 2026" (nombre del mes en castellano)
                                  * cualquier otra variación con guiones, espacios, barras o palabras descriptivas
- "Nombre del empleado :"       seguido del nombre completo de la persona en texto libre (ej: "MARIA HERNANDEZ"). Normalmente en mayúsculas, dos o tres palabras.
- "Identificador de empleado :" seguido de un número de unos 10 dígitos (ej: "9900060333").

Tu tarea:
1. Identificá visualmente esos tres campos.
2. Para el "Nombre del informe": extraé el mes y el año, descartá cualquier texto descriptivo, y devolvelo NORMALIZADO al formato MM/YYYY exacto (mes a dos dígitos + barra + año a cuatro dígitos). Ejemplos:
   * "informe-gastos-03-2026"        -> "03/2026"
   * "informe gastos 03/2026"        -> "03/2026"
   * "Marzo 2026"                    -> "03/2026"
   * "3/2026"                        -> "03/2026"   (zero-pad del mes)
   * "01/2025"                       -> "01/2025"
3. Para el "Nombre del empleado": devolvelo TAL CUAL está impreso, manteniendo la capitalización original (si está en mayúsculas, en mayúsculas).
4. Para el "Identificador de empleado": devolvelo tal cual está impreso (solo dígitos, sin formato).

Reglas:
- El "Nombre del informe" se devuelve SIEMPRE como MM/YYYY exacto. Si no podés determinar mes Y año con seguridad, devolvé null.
- Para el nombre del empleado, no traduzcas ni "corrijas" el nombre. Si parece "MARIA HERNANDEZ", es "MARIA HERNANDEZ".
- Para el identificador, no normalices ni completes ceros: devolvé los dígitos que ves.
- Si no podés leer un campo con seguridad, devolvé null para ese campo.
- Ignorá cualquier otro número, fecha o identificador que aparezca en el documento (identificadores de informe, fechas de transacción, importes, etc.).

CONFIANZA — esto es crítico, sé estricto al evaluar:

Para cada campo devolvé también un nivel de confianza ("high", "medium" o "low") según qué tan SEGURO estás de la lectura:
- "high":   leíste todos los caracteres sin la menor duda. La imagen está nítida y los dígitos son inequívocos.
- "medium": leíste el valor pero al menos un carácter es ambiguo. USALO siempre que tengas la más mínima duda entre dígitos similares.
- "low":    la imagen está borrosa/oscura/recortada, o no podés decidir entre varias lecturas plausibles.

Pares de dígitos que se confunden muy seguido en formularios impresos — si en la imagen aparece uno de estos dígitos y vos no estás 100% seguro de cuál es, marcá AL MENOS "medium":
  • 5 vs 6     • 5 vs 8     • 3 vs 8     • 0 vs 8     • 0 vs 6
  • 1 vs 7     • 6 vs 0     • 4 vs 9     • 2 vs 7
Pensá: "si yo estuviera apostando plata a esta lectura, ¿la firmo sin re-leer? Si no, es medium o low".

Si devolvés value: null (no podés leerlo), la confianza es siempre "low".
Es PREFERIBLE marcar "medium" / "low" de más a marcar "high" cuando dudaste — el usuario va a verificar manualmente, no podés perder un dato pero sí evitar uno equivocado.`;

const CONFIDENCE_VALUES: ReadonlySet<FieldConfidence> = new Set([
  "high",
  "medium",
  "low",
]);

function isExtraction(value: unknown): value is FieldExtraction {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const okValue = typeof v.value === "string" || v.value === null;
  const okConfidence =
    typeof v.confidence === "string" &&
    CONFIDENCE_VALUES.has(v.confidence as FieldConfidence);
  return okValue && okConfidence;
}

function isValidResult(value: unknown): value is ServerOcrResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    isExtraction(v.reportName) &&
    isExtraction(v.employeeName) &&
    isExtraction(v.employeeId)
  );
}

export async function scanDocument(
  imageBuffer: Buffer,
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" = "image/jpeg"
): Promise<ServerOcrResult> {
  const client = getClient();
  const base64 = imageBuffer.toString("base64");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: "Extraé el Nombre del informe, el Nombre del empleado y el Identificador de empleado de esta foto.",
          },
        ],
      },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    output_config: {
      format: { type: "json_schema", schema: REPORT_FIELDS_SCHEMA },
    } as any,
  });

  // The model returns a single text block whose body is the JSON document
  // shaped like REPORT_FIELDS_SCHEMA.
  const textBlock = response.content.find(
    (b): b is Extract<typeof b, { type: "text" }> => b.type === "text"
  );
  if (!textBlock) {
    throw new Error("Claude no devolvió texto. Probá con otra foto.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error(
      `Claude devolvió texto no-JSON: "${textBlock.text.slice(0, 100)}".`
    );
  }
  if (!isValidResult(parsed)) {
    throw new Error(
      "La respuesta de Claude no respeta el formato esperado (reportName / employeeId)."
    );
  }
  return parsed;
}
