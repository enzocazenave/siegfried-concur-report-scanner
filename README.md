# Scanner de Informes

Aplicación web local para automatizar la lectura de informes impresos.
La empleada apoya la hoja frente a la webcam y aprieta **Escanear** — sin
encuadrar, sin marcos, sin calibrar nada. La extracción de los dos campos
("Nombre del informe" e "Identificador de empleado") la hace **Claude Vision**
en el servidor.

- Webcam + foto.
- Backend Node.js que llama a la API de Claude con structured outputs.
- Confirmación manual antes de guardar.
- SQLite + Prisma para persistencia.
- Historial con búsqueda, paginación y exportación a Excel.
- Modo oscuro, toasts.

---

## Stack

| Capa             | Tecnología                                  |
| ---------------- | ------------------------------------------- |
| Frontend         | Next.js 15 (App Router) + TypeScript        |
| UI               | TailwindCSS + Shadcn/UI + lucide-react      |
| OCR              | `@anthropic-ai/sdk` + `claude-opus-4-7` Vision |
| Validación       | `zod` (esquema del output estructurado)     |
| Base de datos    | SQLite                                      |
| ORM              | Prisma                                      |
| Excel            | SheetJS (`xlsx`)                            |
| Notificaciones   | sonner                                      |
| Tema             | next-themes                                 |

---

## Pedido para sistemas

Para que arranque la aplicación necesitan:

1. **Una API key de Anthropic.** La saca cualquier persona con cuenta en
   https://console.anthropic.com → *Settings* → *API Keys* → *Create Key*.
2. **Cargar saldo prepago** (mínimo USD 5) en *Plans & Billing*.

La API key se guarda en el archivo `.env` del proyecto bajo
`ANTHROPIC_API_KEY=sk-ant-...`. No requiere abrir puertos ni nada de
infraestructura: la app local hace requests HTTPS salientes a `api.anthropic.com`.

### Costo estimado por escaneo

Con `claude-opus-4-7` (default, máxima precisión): **~USD 0,025 por escaneo**
(≈ $0,025 dólares = ~$25 pesos al cambio actual). Para 50 escaneos por día,
quedan ~USD 1,25/día = **USD 38/mes**.

Si necesitan abaratar, en el `.env` se puede setear
`ANTHROPIC_MODEL=claude-haiku-4-5` para usar el modelo más chico:
**~USD 0,005 por escaneo** (~USD 7,50/mes para 50/día). En la tarea
(leer dos campos claramente etiquetados) Haiku rinde muy bien.

---

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Crear archivo .env con la API key
cp .env.example .env
# editar .env y poner ANTHROPIC_API_KEY=sk-ant-...

# 3. Crear la base SQLite
npx prisma db push

# 4. Arrancar
npm run dev
```

Abrir http://localhost:3000 y autorizar la cámara.

### Build de producción

```bash
npm run build     # corre prisma db push + next build
npm start         # http://localhost:3000
```

---

## Uso

1. **Inicio (`/`)** — La cámara muestra el preview en vivo.
2. Apoyar la hoja del informe frente a la cámara. **No hace falta encuadrar**:
   Claude lee el documento esté donde esté en la imagen, derecho o un poco
   torcido. Lo único importante es que se vea entera y con luz razonable.
3. Apretar **Escanear**. Tarda ~3-6 segundos (la llamada a Claude).
4. Verificar los dos campos extraídos.
   - Si Claude no pudo leer alguno, queda vacío con borde rojo y el placeholder
     dice "(no detectado — escribilo a mano)".
   - Editar cualquier valor si hace falta.
5. **Confirmar** → guarda en SQLite. **Cancelar** → descarta.
6. **Historial (`/history`)** — Tabla por fecha desc, paginada, con búsqueda
   por identificador y por nombre del informe, y botón **Exportar Excel**.

---

## Estructura

```
report-scanner/
├── prisma/schema.prisma         # modelo Scan
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # /  -> escaneo
│   │   ├── history/page.tsx     # /history
│   │   ├── globals.css
│   │   └── api/
│   │       ├── scan/route.ts    # POST imagen -> Claude Vision -> JSON
│   │       └── scans/
│   │           ├── route.ts     # GET listar / POST guardar
│   │           └── export/route.ts  # GET XLSX
│   ├── components/
│   │   ├── scanner.tsx          # cámara + confirmar/cancelar
│   │   ├── history-table.tsx    # tabla + búsqueda + paginación + export
│   │   ├── theme-provider.tsx
│   │   ├── theme-toggle.tsx
│   │   └── ui/                  # primitivos Shadcn
│   └── lib/
│       ├── ocr.ts               # cliente: captura + POST
│       ├── server-ocr.ts        # backend: Claude SDK + Zod schema
│       ├── prisma.ts
│       └── utils.ts
└── package.json
```

---

## Variables de entorno

| Variable             | Default                 | Para qué                                              |
| -------------------- | ----------------------- | ----------------------------------------------------- |
| `DATABASE_URL`       | `file:./dev.db`         | Ubicación del SQLite                                  |
| `ANTHROPIC_API_KEY`  | *(requerida)*           | Key de Anthropic. Sin esto, `/api/scan` devuelve 500. |
| `ANTHROPIC_MODEL`    | `claude-opus-4-7`       | Modelo de Claude a usar.                              |

---

## Despliegue local

```bash
git clone <repo>
cd report-scanner
npm install
cp .env.example .env             # editar con la API key
npm run build
npm start
```

Para que arranque solo al iniciar sesión: `npm start` como servicio
(`systemd` en Linux, Programador de tareas en Windows).

---

## Notas

- **Sin login, sin usuarios, sin roles** — entorno controlado.
- **Sin local OCR**: ya probamos con Tesseract + OpenCV y resultó frágil
  (requería encuadrar, calibrar regiones, foco perfecto). Claude lee la hoja
  sin pedirle nada al usuario, que era el requisito.
- **Privacidad**: cada foto se manda a `api.anthropic.com`. Anthropic NO usa
  el contenido de la API para entrenar modelos
  (https://www.anthropic.com/legal/commercial-terms). Si la sensibilidad del
  documento lo exige, validar igual con compliance.
- **Output estructurado**: usamos `messages.parse()` con un schema Zod, así
  el JSON viene garantizado bien formado — sin parseo frágil de texto libre.
