"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Combobox liviano (sin dependencias extra) para elegir el equipo:
 *  - busca dentro de los equipos ya cargados mientras se tipea;
 *  - permite seleccionar uno existente de la lista;
 *  - si lo tipeado no existe, se usa tal cual (se creará un equipo nuevo).
 */
export function TeamCombobox({
  value,
  onChange,
  teams,
  id,
  placeholder = "Buscar o crear equipo…",
}: {
  value: string;
  onChange: (v: string) => void;
  teams: string[];
  id?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Cerrar al hacer click afuera.
  React.useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const trimmed = value.trim();
  const query = trimmed.toLowerCase();
  const filtered = query
    ? teams.filter((t) => t.toLowerCase().includes(query))
    : teams;
  // ¿Lo tipeado coincide exactamente con un equipo existente?
  const exactExists = teams.some((t) => t.toLowerCase() === query);
  const isNew = trimmed.length > 0 && !exactExists;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
        />
        <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {filtered.length > 0 ? (
            filtered.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    t.toLowerCase() === query ? "opacity-100" : "opacity-0"
                  )}
                />
                {t}
              </button>
            ))
          ) : (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No hay equipos que coincidan.
            </div>
          )}

          {isNew && (
            <div className="mt-1 flex items-center gap-2 border-t px-2 py-1.5 text-sm text-muted-foreground">
              <Plus className="h-4 w-4 shrink-0 text-green-600" />
              <span>
                Se creará el equipo nuevo: <strong>{trimmed}</strong>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
