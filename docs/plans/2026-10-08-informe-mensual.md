# Informe Mensual (Fase 1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generar el informe mensual de mantenimiento dentro de JosTools: pagina `/reports` con las 6 secciones del PDF del cliente, conclusiones editables, export PDF (con graficas via html2canvas) y export Excel.

**Architecture:** Pagina client-side `/reports` que carga `maintenance_events` + `vehicles` con los servicios existentes y calcula todo en `reportService` (funciones puras). Se agregan 3 campos de datos (`fleet_group` en vehiculos; `observation` y `block_reason` en eventos). Exports en `reportExportService` (jsPDF + autotable + html2canvas; xlsx). Diseno aprobado en `docs/plans/2026-10-08-informe-mensual-design.md`.

**Tech Stack:** Next.js 16, React 18, TypeScript, Tailwind v4, Firestore (npm workspaces), jspdf + jspdf-autotable (ya instalados), xlsx (ya instalado), recharts (ya instalado), html2canvas (nueva dependencia).

**Reglas del repo (obligatorias):**
- Sin comentarios de codigo, sin emojis. UI en espanol acento-free ("Vehiculo", "Codigo", "configuracion").
- Estilos inline con CSS vars (`var(--graphite-900)` etc.) + clases Tailwind, igual que el resto de la app.
- Verificacion de cada tarea: `npx tsc --noEmit` (workdir `apps/web`). Al final de cada bloque: `npm run build`.
- **NUNCA commitear sin pedir permiso explicito al usuario.** Los pasos de commit de este plan se reemplazan por "Preguntar al usuario si desea commitear".
- Este repo NO tiene framework de tests: la verificacion es tsc + build + prueba manual.
- Instalar dependencias SOLO con npm 10: desde la raiz del repo, `npx npm@10.9.0 install <pkg> -w apps/web` (nunca npm 11/12 — rompe el lockfile).

---

### Task 1: Campos nuevos en types

**Files:**
- Modify: `apps/web/src/types/vehicle.ts`
- Modify: `apps/web/src/types/maintenance.ts`

**Step 1: fleet_group en Vehicle**

En `vehicle.ts`, al final de `interface Vehicle` (antes del cierre):

```ts
export interface Vehicle {
  id: string;
  vehicle_id: string;
  brand: string;
  model: string;
  year: number;
  enterpriseId: string;
  created_by: string;
  created_at: string;
  fleet_group?: string;
}
```

Y al final del archivo:

```ts
export const FLEET_GROUP_OPTIONS = ["MQ", "VP-EP-VB-VC", "VL-TP", "Maquinaria", "Carga pesada", "Livianos"];
```

**Step 2: observation y block_reason en MaintenanceEvent**

En `maintenance.ts`, en `interface MaintenanceEvent` despues de `edit_history?: EditHistoryEntry[];`:

```ts
  observation?: string;
  block_reason?: string;
```

Despues de `EVENT_STATUS_LABELS`:

```ts
export const BLOCK_REASON_OPTIONS = [
  { name: "", label: "Sin bloqueo" },
  { name: "FALTA_REPUESTO", label: "Falta repuesto" },
  { name: "FALTA_PAGO", label: "Falta de pago" },
  { name: "SIN_DISPONIBILIDAD", label: "Sin disponibilidad del usuario" },
  { name: "OTRO", label: "Otro" },
];

export const BLOCK_REASON_LABELS: Record<string, string> = {
  FALTA_REPUESTO: "Falta repuesto",
  FALTA_PAGO: "Falta de pago",
  SIN_DISPONIBILIDAD: "Sin disponibilidad del usuario",
  OTRO: "Otro",
};
```

En `FIELD_LABELS` agregar:

```ts
  observation: "Observacion",
  block_reason: "Motivo de bloqueo",
```

**Step 3: verificar**

Run: `npx tsc --noEmit` (workdir `apps/web`)
Expected: exit 0, sin errores.

---

### Task 2: fleet_group en VehicleModal + createVehicle

**Files:**
- Modify: `apps/web/src/components/VehicleModal.tsx`
- Modify: `apps/web/src/lib/services/vehicleService.ts` (`createVehicle`, line ~39-75)

**Step 1: estado y input en VehicleModal**

Importar `FLEET_GROUP_OPTIONS` de `@/types/vehicle`. Agregar estado junto a los demas:

```tsx
const [fleetGroup, setFleetGroup] = useState("");
```

Despues del campo "Anio" (antes del `<div className="flex gap-3 pt-2">` de los botones), agregar el campo — datalist permite elegir opcion fija o escribir otro:

```tsx
<div>
  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>
    Grupo de flota
    <HelpTip title="Grupo de flota" text="Agrupa el vehiculo para el informe mensual: MQ, VP-EP-VB-VC, VL-TP, Maquinaria, Carga pesada o Livianos. Puede elegir una opcion o escribir otra. Opcional; los vehiculos sin grupo aparecen como 'Sin grupo' en la distribucion del informe." />
  </label>
  <input
    type="text"
    value={fleetGroup}
    onChange={(e) => setFleetGroup(e.target.value)}
    placeholder="Ej: MQ"
    list="fleet-group-options"
    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
    style={inputStyle}
  />
  <datalist id="fleet-group-options">
    {FLEET_GROUP_OPTIONS.map((g) => (
      <option key={g} value={g} />
    ))}
  </datalist>
</div>
```

En el payload de `createVehicle` dentro de `handleSubmit`:

```ts
      const vehicle = await createVehicle({
        vehicle_id: vehicleId,
        brand,
        model,
        year: Number(year),
        enterpriseId,
        created_by: createdBy,
        fleet_group: fleetGroup.trim() || undefined,
      });
```

**Step 2: persistir en createVehicle (vehicleService.ts)**

Agregar `updateDoc` al import de `@firebase/firestore` (se usa en Step 4). En `createVehicle`, el `setDoc` explicito debe incluir el campo:

```ts
  await setDoc(doc(vehiclesRef, id), {
    vehicle_id: vehicleId,
    brand: data.brand.trim(),
    model: data.model.trim(),
    year: data.year,
    enterpriseId: data.enterpriseId,
    created_by: data.created_by,
    created_at,
    ...(data.fleet_group ? { fleet_group: data.fleet_group.trim() } : {}),
  });
```

(Y el objeto de retorno igual, agregando `fleet_group` si existe — ver codigo actual al final de `createVehicle`.)

**Step 3: servicio de actualizacion para el asignador (Task 6)**

Al final de `vehicleService.ts`:

```ts
export async function updateVehicleFleetGroup(vehicle: Vehicle, fleetGroup: string): Promise<void> {
  await updateDoc(doc(vehiclesRef, vehicle.id), { fleet_group: fleetGroup.trim() });
}
```

**Step 4: verificar**

Run: `npx tsc --noEmit` y luego `npm run build` (workdir `apps/web`)
Expected: exit 0.

---

### Task 3: observation en MaintenanceForm (alta)

**Files:**
- Modify: `apps/web/src/components/MaintenanceForm.tsx`

**Step 1: estado**

En `createInitialFormData()` (line ~33), agregar:

```ts
    observation: "",
```

**Step 2: payload**

En `handleSubmit`, dentro del objeto `event: MaintenanceEventInput` (line ~237), agregar antes de `user_id`:

```ts
        observation: formData.observation.trim(),
```

**Step 3: UI — textarea**

Despues de la seccion "Horas y Costo" (el bloque `grid ... mb-8` que contiene horas y costo, line ~545) y antes del bloque de botones de submit, agregar:

```tsx
      <div className="mb-8">
        <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>
          Observacion / Pendiente
          <HelpTip title="Observacion" text="Nota libre sobre el evento: pendientes, repuestos faltantes, detalles para la proxima intervencion (ej: 'Faltan tapas del eje muerto'). Se muestra en el detalle del evento y es la columna de observaciones del Informe Mensual." />
        </label>
        <textarea
          name="observation"
          value={formData.observation}
          onChange={handleChange}
          placeholder="Ej: Faltan repuestos, pendiente de prueba de ruta"
          rows={3}
          className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all resize-y"
          style={inputStyle}
        />
      </div>
```

Verificar que `handleChange` (no `handleSelectChange`) existe para campos de texto (existe: maneja `name`/`value`).

**Step 4: verificar**

Run: `npx tsc --noEmit`
Expected: exit 0.

---

### Task 4: observation y block_reason en detalle, edicion y lista

**Files:**
- Modify: `apps/web/src/app/records/[id]/editar/page.tsx`
- Modify: `apps/web/src/app/records/[id]/page.tsx`
- Modify: `apps/web/src/app/records/page.tsx`
- Modify: `apps/web/src/lib/services/maintenanceService.ts` (`reopenMaintenanceEvent`)

**Step 1: editar page — estado**

En el `useState` de `formData` (line ~54) agregar:

```ts
    observation: "",
    block_reason: "",
```

En el `setFormData` de carga (line ~95) agregar:

```ts
              observation: ev.observation || "",
              block_reason: ev.block_reason || "",
```

En el `data` de `handleSubmit` (line ~169) agregar antes del cierre:

```ts
        observation: formData.observation.trim(),
        block_reason: formData.block_reason,
```

(`buildEventChanges` itera las keys de `data`, asi que el diff y el historial funcionan solos con `FIELD_LABELS` agregado en Task 1.)

**Step 2: editar page — UI**

Al final del `<form>`, antes del boton "Guardar cambios" (buscar `<button type="submit"`), agregar un bloque nuevo:

```tsx
        <div className="mb-8">
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>
            Observacion / Pendiente
            <HelpTip title="Observacion" text="Nota libre sobre el evento: pendientes o repuestos faltantes. Se muestra en el detalle y en la seccion de observaciones del Informe Mensual." />
          </label>
          <textarea
            name="observation"
            value={formData.observation}
            onChange={(e) => updateField("observation", e.target.value)}
            placeholder="Ej: Faltan repuestos, pendiente de prueba de ruta"
            rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all resize-y"
            style={inputStyle}
          />
        </div>
        <div className="mb-8">
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>
            Motivo de bloqueo
            <HelpTip title="Motivo de bloqueo" text="Si el evento esta detenido (falta repuesto, falta de pago, sin disponibilidad), indiquelo aqui. Los eventos bloqueados cuentan en el backlog del Informe Mensual. Con 'Sin bloqueo' no cuenta." />
          </label>
          <select
            value={formData.block_reason}
            onChange={(e) => updateField("block_reason", e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer"
            style={inputStyle}
          >
            {BLOCK_REASON_OPTIONS.map((o) => (
              <option key={o.name} value={o.name}>{o.label}</option>
            ))}
          </select>
        </div>
```

Importar `BLOCK_REASON_OPTIONS` desde `@/types/maintenance`.

**Step 3: detalle page — filas de info**

En el array `items` (line ~118), despues de `{ label: "Costo reparacion", ... }`:

```ts
    { label: "Observacion", value: event.observation?.trim() ? event.observation : "--" },
    ...(event.block_reason ? [{ label: "Motivo de bloqueo", value: BLOCK_REASON_LABELS[event.block_reason] ?? event.block_reason }] : []),
```

Importar `BLOCK_REASON_LABELS`.

**Step 4: detalle page — selector rapido de bloqueo (solo abierto)**

Junto al array `items` (line ~135), cuando `isOpen`, renderizar un control que guarda al instante. Importar `buildEventChanges, saveEventChanges` desde `@/lib/services/maintenanceService` y `useAppSelector` (ya importado en la page? si no, importarlo) y `BLOCK_REASON_OPTIONS`:

```tsx
  const handleBlockReason = async (value: string) => {
    if (!event) return;
    const changes = buildEventChanges(event, { block_reason: value });
    await saveEventChanges(event.id, { block_reason: value }, changes, user?.displayName || "Usuario");
    await load();
  };
```

(Confirmar que `load` y `user` existen en el scope — `load` se define line ~51 y `user` viene de `useAppSelector` line ~44.)

Justo antes del grid de informacion (`<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px"` line ~214), agregar (solo cuando `isOpen`):

```tsx
          {isOpen && (
            <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-800)" }}>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>
                Motivo de bloqueo
                <HelpTip title="Motivo de bloqueo" text="Marca si el evento esta detenido (falta repuesto, falta de pago, sin disponibilidad). Los eventos bloqueados cuentan en el backlog del Informe Mensual. Se guarda automaticamente." />
              </label>
              <select
                value={event.block_reason || ""}
                onChange={(e) => { handleBlockReason(e.target.value); }}
                className="px-4 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-100)" }}
              >
                {BLOCK_REASON_OPTIONS.map((o) => (
                  <option key={o.name} value={o.name}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
```

**Step 5: lista de registros — badge**

En `records/page.tsx`, en la celda de Estado (badge existente line ~259-266), despues del span del estado, agregar:

```tsx
                          {event.block_reason ? (
                            <span
                              className="ml-1.5 inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap cursor-help"
                              title={`Bloqueado: ${BLOCK_REASON_LABELS[event.block_reason] ?? event.block_reason}`}
                              style={{ backgroundColor: "rgba(224, 31, 95, 0.12)", color: "var(--raspberry-red-400)" }}
                            >
                              Bloqueado
                            </span>
                          ) : null}
```

Importar `BLOCK_REASON_LABELS`.

**Step 6: reabrir limpia el bloqueo**

En `reopenMaintenanceEvent` (maintenanceService.ts), en el objeto `updateDoc` agregar `block_reason: "",` y, si `event.block_reason`, agregar al array `changes`:

```ts
  if (event.block_reason) {
    changes.push({ field: "block_reason", label: FIELD_LABELS.block_reason, from: BLOCK_REASON_LABELS[event.block_reason] ?? event.block_reason, to: "vacio" });
  }
```

Importar `BLOCK_REASON_LABELS`.

**Step 7: verificar**

Run: `npx tsc --noEmit` y `npm run build`
Expected: exit 0.

---

### Task 5: reportService

**Files:**
- Create: `apps/web/src/lib/services/reportService.ts`

**Step 1: escribir el servicio completo**

```ts
import type { MaintenanceEvent } from "@/types/maintenance";
import { SYSTEM_CATEGORY_LABELS } from "@/types/maintenance";
import type { Vehicle } from "@/types/vehicle";
import { calculateIndicators, type Indicators } from "./indicatorService";

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export interface ReportGroup {
  label: string;
  count: number;
}

export interface ReportData {
  monthKey: string;
  monthLabel: string;
  events: MaintenanceEvent[];
  preventive: MaintenanceEvent[];
  corrective: MaintenanceEvent[];
  inspection: MaintenanceEvent[];
  predictive: MaintenanceEvent[];
  total: number;
  preventivePct: number;
  correctivePct: number;
  closedInMonth: number;
  inCycle: number;
  closureEfficiency: number | null;
  backlog: MaintenanceEvent[];
  byFleetGroup: ReportGroup[];
  bySystem: ReportGroup[];
  costTotal: number;
  indicators: Indicators;
}

export function monthKeyOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabelOf(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

export function getMonthOptions(events: MaintenanceEvent[]): string[] {
  const set = new Set<string>();
  events.forEach((e) => {
    const key = monthKeyOf(e.failure_timestamp);
    if (key) set.add(key);
  });
  return Array.from(set).sort().reverse();
}

function inMonth(iso: string, start: number, end: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t >= start && t < end;
}

function groupCount(events: MaintenanceEvent[], keyOf: (e: MaintenanceEvent) => string): ReportGroup[] {
  const map = new Map<string, number>();
  events.forEach((e) => {
    const k = keyOf(e);
    map.set(k, (map.get(k) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildReport(events: MaintenanceEvent[], vehicles: Vehicle[], monthKey: string): ReportData | null {
  if (!monthKey) return null;
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(y, m - 1, 1).getTime();
  const end = new Date(y, m, 1).getTime();

  const monthEvents = events.filter((e) => inMonth(e.failure_timestamp, start, end));
  const preventive = monthEvents.filter((e) => e.event_type === "PREVENTIVE");
  const corrective = monthEvents.filter((e) => e.event_type === "CORRECTIVE");
  const inspection = monthEvents.filter((e) => e.event_type === "INSPECTION");
  const predictive = monthEvents.filter((e) => e.event_type === "PREDICTIVE");

  const total = monthEvents.length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

  const closedInMonth = events.filter((e) => inMonth(e.workshop_exit_time, start, end)).length;
  const inCycle = events.filter((e) => {
    const entry = new Date(e.workshop_entry_time).getTime();
    if (Number.isNaN(entry) || entry >= end) return false;
    if (!e.workshop_exit_time) return true;
    const exit = new Date(e.workshop_exit_time).getTime();
    return Number.isNaN(exit) || exit >= start;
  }).length;
  const closureEfficiency = inCycle > 0 ? Math.round((closedInMonth / inCycle) * 1000) / 10 : null;

  const backlog = events.filter((e) => !e.status || e.status === "PENDING" || !!e.block_reason?.trim());

  const vehicleMap = new Map(vehicles.map((v) => [v.vehicle_id, v]));
  const byFleetGroup = groupCount(monthEvents, (e) => vehicleMap.get(e.vehicle_id)?.fleet_group?.trim() || "Sin grupo");
  const bySystem = groupCount(monthEvents, (e) => SYSTEM_CATEGORY_LABELS[e.system_category] ?? e.system_category);

  const costTotal = monthEvents.reduce((sum, e) => sum + (e.repair_cost || 0), 0);

  return {
    monthKey,
    monthLabel: monthLabelOf(monthKey),
    events: monthEvents,
    preventive,
    corrective,
    inspection,
    predictive,
    total,
    preventivePct: pct(preventive.length),
    correctivePct: pct(corrective.length),
    closedInMonth,
    inCycle,
    closureEfficiency,
    backlog,
    byFleetGroup,
    bySystem,
    costTotal,
    indicators: calculateIndicators(monthEvents),
  };
}

export function generateConclusions(report: ReportData): string {
  const topSystems = report.bySystem.slice(0, 3).map((s) => `${s.label} (${s.count})`).join(", ");
  const eficiencia = report.closureEfficiency != null ? `${report.closureEfficiency}%` : "sin datos";
  const partes = [
    `Durante ${report.monthLabel} se registraron ${report.total} intervenciones de mantenimiento: ${report.preventivePct}% preventivas (${report.preventive.length}) y ${report.correctivePct}% correctivas (${report.corrective.length}).`,
    `La eficiencia de cierre fue de ${eficiencia}, con ${report.closedInMonth} evento(s) cerrados en el mes.`,
    `El backlog actual es de ${report.backlog.length} evento(s) abierto(s) o bloqueado(s).`,
    `El costo total de reparaciones del mes alcanzo $${report.costTotal.toLocaleString("es-ES")}.`,
  ];
  if (topSystems) partes.push(`Los sistemas con mayor incidencia fueron: ${topSystems}.`);
  return partes.join(" ");
}
```

**Step 2: verificar**

Run: `npx tsc --noEmit`
Expected: exit 0.

---

### Task 6: Componente FleetGroupConfig (asignador de flota)

**Files:**
- Create: `apps/web/src/components/FleetGroupConfig.tsx`

**Step 1: escribir el componente**

```tsx
"use client";

import { useState } from "react";
import HelpTip from "@/components/HelpTip";
import { FLEET_GROUP_OPTIONS, type Vehicle } from "@/types/vehicle";
import { updateVehicleFleetGroup } from "@/lib/services/vehicleService";

interface FleetGroupConfigProps {
  vehicles: Vehicle[];
  onSaved: () => void;
}

export default function FleetGroupConfig({ vehicles, onSaved }: FleetGroupConfigProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Record<string, string>>(() =>
    Object.fromEntries(vehicles.map((v) => [v.vehicle_id, v.fleet_group ?? ""]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = vehicles.filter((v) => (groups[v.vehicle_id] ?? "") !== (v.fleet_group ?? ""));
  const sinGrupo = vehicles.filter((v) => !v.fleet_group?.trim()).length;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const v of pending) {
        await updateVehicleFleetGroup(v, groups[v.vehicle_id] ?? "");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los grupos");
    } finally {
      setSaving(false);
    }
  };

  const selectStyle = {
    backgroundColor: "var(--graphite-800)",
    border: "1px solid var(--graphite-600)",
    color: "var(--graphite-100)",
  };

  return (
    <div className="mb-6 rounded-2xl border" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
      >
        <span className="text-sm font-semibold" style={{ color: "var(--graphite-200)" }}>
          Configurar flota
          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "rgba(247, 183, 8, 0.15)", color: "var(--tuscan-sun-400)" }}>
            {sinGrupo} sin grupo
          </span>
          <HelpTip title="Grupo de flota" text="Asigna cada vehiculo a un grupo (MQ, VP-EP-VB-VC, VL-TP, Maquinaria, Carga pesada, Livianos) para que el Informe Mensual pueda mostrar la distribucion por tipo de flota. Los vehiculos sin grupo aparecen como 'Sin grupo'." />
        </span>
        <svg className="w-4 h-4 transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "var(--graphite-400)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5">
          {error && (
            <div className="mb-3 p-3 rounded-xl text-sm" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
              {error}
            </div>
          )}
          <div className="max-h-80 overflow-y-auto rounded-xl" style={{ border: "1px solid var(--graphite-800)" }}>
            {vehicles.map((v, i) => (
              <div
                key={v.id}
                className="flex items-center gap-3 px-4 py-2.5"
                style={{ borderTop: i === 0 ? "none" : "1px solid var(--graphite-800)" }}
              >
                <span className="w-32 font-mono text-[13px] font-semibold shrink-0" style={{ color: "var(--graphite-100)" }}>{v.vehicle_id}</span>
                <span className="flex-1 text-sm truncate" style={{ color: "var(--graphite-400)" }}>{`${v.brand} ${v.model} ${v.year || ""}`.trim()}</span>
                <select
                  value={groups[v.vehicle_id] ?? ""}
                  onChange={(e) => setGroups((prev) => ({ ...prev, [v.vehicle_id]: e.target.value }))}
                  className="px-3 py-1.5 rounded-lg text-xs outline-none cursor-pointer shrink-0"
                  style={selectStyle}
                >
                  <option value="">Sin grupo</option>
                  {FLEET_GROUP_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || pending.length === 0}
              className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all disabled:opacity-50"
              style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}
            >
              {saving ? "Guardando..." : `Guardar${pending.length > 0 ? ` (${pending.length})` : ""}`}
            </button>
            <span className="text-xs" style={{ color: "var(--graphite-500)" }}>
              {pending.length > 0 ? `${pending.length} cambio(s) sin guardar` : "Todo guardado"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: verificar**

Run: `npx tsc --noEmit`
Expected: exit 0.

---

### Task 7: Pagina /reports

**Files:**
- Create: `apps/web/src/app/reports/page.tsx`

**Step 1: escribir la pagina completa**

```tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import HelpTip from "@/components/HelpTip";
import FleetGroupConfig from "@/components/FleetGroupConfig";
import EventTypePieChart from "@/components/charts/EventTypePieChart";
import { useAppSelector } from "@/lib/redux/hooks";
import { getMaintenanceEvents } from "@/lib/services/maintenanceService";
import { getVehicles } from "@/lib/services/vehicleService";
import { getEventTypePieData, formatHours } from "@/lib/services/indicatorService";
import { buildReport, getMonthOptions, monthLabelOf, generateConclusions, type ReportData, type ReportGroup } from "@/lib/services/reportService";
import { exportReportToPdf, exportReportToExcel } from "@/lib/services/reportExportService";
import { EVENT_TYPE_SHORT_LABELS, SYSTEM_CATEGORY_LABELS, BLOCK_REASON_LABELS, EVENT_STATUS_LABELS, type MaintenanceEvent } from "@/types/maintenance";
import type { Vehicle } from "@/types/vehicle";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const kpiCard = (label: string, value: string, help: string) => (
  <div key={label} className="rounded-2xl border p-4" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
    <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--graphite-500)" }}>
      {label}
      <HelpTip title={label} text={help} />
    </p>
    <p className="text-xl font-bold" style={{ color: "var(--graphite-100)" }}>{value}</p>
  </div>
);

function ReportBarChart({ data }: { data: ReportGroup[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--graphite-800)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} stroke="#6b6b70" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={150} stroke="#6b6b70" tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1b1819", border: "1px solid #4a4446", borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: "#f4f4f5" }}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey="count" fill="#F7B708" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function eventRows(list: MaintenanceEvent[]) {
  return list.map((e) => ({
    Vehiculo: e.vehicle_id,
    Falla: new Date(e.failure_timestamp).toLocaleDateString("es-ES"),
    Sistema: SYSTEM_CATEGORY_LABELS[e.system_category] ?? e.system_category,
    Estado: EVENT_STATUS_LABELS[e.status || "PENDING"],
    Observacion: e.observation?.trim() || "--",
  }));
}

export default function ReportsPage() {
  const { user } = useAppSelector((state) => state.auth);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthKey, setMonthKey] = useState("");
  const [conclusions, setConclusions] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const pieRef = useRef<HTMLDivElement>(null);
  const flotaRef = useRef<HTMLDivElement>(null);
  const sistemaRef = useRef<HTMLDivElement>(null);

  const loadData = () => {
    if (!user?.enterpriseId) return;
    Promise.all([getMaintenanceEvents(user.enterpriseId), getVehicles(user.enterpriseId)]).then(([evs, vehs]) => {
      setEvents(evs);
      setVehicles(vehs);
      setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, [user?.enterpriseId]);

  const monthOptions = useMemo(() => getMonthOptions(events), [events]);

  useEffect(() => {
    if (monthOptions.length > 0 && !monthKey) setMonthKey(monthOptions[0]);
  }, [monthOptions, monthKey]);

  const report = useMemo(() => buildReport(events, vehicles, monthKey), [events, vehicles, monthKey]);

  useEffect(() => {
    if (report) setConclusions(generateConclusions(report));
  }, [report?.monthKey]);

  const handleExportPdf = async () => {
    if (!report) return;
    setExporting("pdf");
    try {
      await exportReportToPdf(report, conclusions, [pieRef.current, flotaRef.current, sistemaRef.current]);
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = () => {
    if (!report) return;
    setExporting("excel");
    try {
      exportReportToExcel(report, conclusions);
    } finally {
      setExporting(null);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: "var(--graphite-950)" }}>
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h1 className="text-2xl font-bold" style={{ color: "var(--graphite-100)" }}>
              Informe Mensual
              <HelpTip title="Informe mensual" text="Informe automatico del mes, igual al PDF que se hacia a mano: resumen, preventivos, correctivos, distribucion por flota y sistema, backlog y conclusiones. Elige el mes, revisa los numeros, edita las conclusiones si quieres y exporta en PDF o Excel." />
            </h1>
            <div className="flex items-center gap-3">
              <select
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                className="px-4 py-2 rounded-xl text-sm outline-none cursor-pointer"
                style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{monthLabelOf(m)}</option>
                ))}
              </select>
              <button
                onClick={handleExportPdf}
                disabled={!report || exporting !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all disabled:opacity-50"
                style={{ backgroundColor: "rgba(0, 81, 255, 0.15)", color: "var(--crayola-blue-400)", border: "1px solid rgba(0, 81, 255, 0.3)" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {exporting === "pdf" ? "Generando..." : "Exportar PDF"}
              </button>
              <button
                onClick={handleExportExcel}
                disabled={!report || exporting !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all disabled:opacity-50"
                style={{ backgroundColor: "rgba(102, 153, 145, 0.15)", color: "var(--ash-grey-400)", border: "1px solid rgba(102, 153, 145, 0.3)" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {exporting === "excel" ? "Generando..." : "Exportar Excel"}
              </button>
            </div>
          </div>

          <FleetGroupConfig vehicles={vehicles} onSaved={loadData} />

          {loading ? (
            <div className="text-center py-20" style={{ color: "var(--graphite-500)" }}>Cargando informe...</div>
          ) : !report ? (
            <div className="text-center py-20 rounded-xl" style={{ color: "var(--graphite-500)", border: "1px solid var(--graphite-800)", backgroundColor: "var(--graphite-900)" }}>
              Selecciona un mes para generar el informe
            </div>
          ) : report.total === 0 ? (
            <div className="text-center py-20 rounded-xl" style={{ color: "var(--graphite-500)", border: "1px solid var(--graphite-800)", backgroundColor: "var(--graphite-900)" }}>
              No hay eventos registrados en {report.monthLabel}
            </div>
          ) : (
            <>
              <div className="mb-6 p-5 rounded-2xl border" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                  <h2 className="text-lg font-bold" style={{ color: "var(--graphite-100)" }}>Informe Mensual de Mantenimiento e Infraestructura</h2>
                  <span className="text-sm" style={{ color: "var(--graphite-400)" }}>
                    {report.monthLabel} | Generado: {new Date().toLocaleDateString("es-ES")}
                  </span>
                </div>
                <p className="text-sm" style={{ color: "var(--graphite-500)" }}>Fuente: eventos de mantenimiento de la empresa</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {kpiCard("Total", String(report.total), "Intervenciones registradas con fecha de falla en el mes.")}
                {kpiCard("Preventivos", `${report.preventivePct}%`, "Porcentaje de eventos tipo Preventivo sobre el total del mes.")}
                {kpiCard("Correctivos", `${report.correctivePct}%`, "Porcentaje de eventos tipo Correctivo sobre el total del mes.")}
                {kpiCard("Eficiencia de cierre", report.closureEfficiency != null ? `${report.closureEfficiency}%` : "--", "Eventos cerrados en el mes dividido entre los que estuvieron en taller durante el mes, por 100.")}
                {kpiCard("Backlog", String(report.backlog.length), "Eventos abiertos o cerrados con motivo de bloqueo: todavia tienen trabajo pendiente.")}
                {kpiCard("Costo del mes", `$${report.costTotal.toLocaleString("es-ES")}`, "Suma de costos de reparacion de los eventos del mes.")}
              </div>

              <div className="mb-4 p-4 rounded-2xl border" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <p className="text-sm mb-2 font-semibold" style={{ color: "var(--graphite-300)" }}>Indicadores del mes</p>
                <p className="text-sm" style={{ color: "var(--graphite-400)" }}>
                  MTTR: {report.indicators.mttr != null ? formatHours(report.indicators.mttr) : "--"}
                  {" | "}MTBF: {report.indicators.mtbf != null ? formatHours(report.indicators.mtbf) : "--"}
                  {" | "}Disponibilidad: {report.indicators.availability != null ? `${report.indicators.availability}%` : "--"}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div ref={pieRef} className="rounded-2xl" style={{ backgroundColor: "var(--graphite-900)" }}>
                  <EventTypePieChart data={getEventTypePieData(report.events)} />
                </div>
                <div ref={flotaRef} className="rounded-2xl border p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                  <p className="text-sm font-semibold mb-3" style={{ color: "var(--graphite-200)" }}>
                    Distribucion por flota
                    <HelpTip title="Distribucion por flota" text="Eventos del mes agrupados por el grupo de flota del vehiculo (MQ, VP-EP-VB-VC, VL-TP, Maquinaria...). Los vehiculos sin grupo aparecen como 'Sin grupo'." />
                  </p>
                  <ReportBarChart data={report.byFleetGroup} />
                </div>
                <div ref={sistemaRef} className="rounded-2xl border p-6 lg:col-span-2" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                  <p className="text-sm font-semibold mb-3" style={{ color: "var(--graphite-200)" }}>
                    Distribucion por sistema afectado
                    <HelpTip title="Distribucion por sistema" text="Eventos del mes agrupados por el sistema del vehiculo donde ocurrio la falla (Motor, Frenos, Electrico...)." />
                  </p>
                  <ReportBarChart data={report.bySystem} />
                </div>
              </div>

              <div className="mb-6 rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--graphite-800)" }}>
                  <h2 className="text-sm font-bold" style={{ color: "var(--graphite-100)" }}>
                    Seccion 1 - Preventivos ({report.preventive.length})
                    <HelpTip title="Seccion 1" text="Intervenciones preventivas y de inspeccion programadas del mes (lista del informe original)." />
                  </h2>
                </div>
                <ReportTable rows={eventRows([...report.preventive, ...report.inspection, ...report.predictive])} />
              </div>

              <div className="mb-6 rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--graphite-800)" }}>
                  <h2 className="text-sm font-bold" style={{ color: "var(--graphite-100)" }}>
                    Seccion 2 - Correctivos ({report.corrective.length})
                    <HelpTip title="Seccion 2" text="Fallas imprevistas del mes con su observacion o pendiente (lista del informe original)." />
                  </h2>
                </div>
                <ReportTable rows={eventRows(report.corrective)} />
              </div>

              <div className="mb-6 rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--graphite-800)" }}>
                  <h2 className="text-sm font-bold" style={{ color: "var(--graphite-100)" }}>
                    Backlog ({report.backlog.length})
                    <HelpTip title="Backlog" text="Eventos todavia abiertos o cerrados con motivo de bloqueo: unidades que siguen retenidas o con trabajo pendiente." />
                  </h2>
                </div>
                {report.backlog.length === 0 ? (
                  <p className="px-5 py-4 text-sm" style={{ color: "var(--graphite-500)" }}>Sin backlog: todos los eventos estan cerrados y sin bloqueos.</p>
                ) : (
                  <ReportTable
                    rows={report.backlog.map((e) => ({
                      Vehiculo: e.vehicle_id,
                      Estado: EVENT_STATUS_LABELS[e.status || "PENDING"],
                      Sistema: SYSTEM_CATEGORY_LABELS[e.system_category] ?? e.system_category,
                      Motivo: e.block_reason ? BLOCK_REASON_LABELS[e.block_reason] ?? e.block_reason : "Sin bloqueo",
                      Falla: new Date(e.failure_timestamp).toLocaleDateString("es-ES"),
                    }))}
                  />
                )}
              </div>

              <div className="mb-6 rounded-2xl border p-5" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <label className="block text-sm font-bold mb-2" style={{ color: "var(--graphite-100)" }}>
                  Conclusiones
                  <HelpTip title="Conclusiones" text="Parrafo automatico con los numeros del mes. Puedes editarlo antes de exportar; el texto que se ve es el que se exporta en PDF y Excel." />
                </label>
                <textarea
                  value={conclusions}
                  onChange={(e) => setConclusions(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all resize-y"
                  style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-100)" }}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

function ReportTable({ rows }: { rows: Record<string, string>[] }) {
  if (rows.length === 0) {
    return <p className="px-5 py-4 text-sm" style={{ color: "var(--graphite-500)" }}>Sin eventos en esta seccion.</p>;
  }
  const columns = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ backgroundColor: "var(--graphite-800)", color: "var(--graphite-400)" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--graphite-800)" }}>
              {columns.map((c) => (
                <td key={c} className="px-4 py-2.5 align-top" style={{ color: "var(--graphite-300)" }}>
                  {row[c] || "--"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Notas de implementacion:
- `reportExportService` aun no existe (Task 8): temporalmente crear un stub o hacer Task 8 primero. **Orden recomendado: ejecutar Task 8 (servicio + dependencia) antes que Task 7, o crear la pagina y el servicio en la misma sesion.**
- El `useEffect` de conclusiones depende de `report?.monthKey` (regenera al cambiar de mes, conserva ediciones mientras no cambies).
- `EventTypePieChart` ya trae su propio card oscuro; el wrapper con `ref` es para la captura.

**Step 2: verificar**

Run: `npx tsc --noEmit`
Expected: exit 0 (una vez exista reportExportService).

---

### Task 8: reportExportService — PDF con html2canvas

**Files:**
- Create: `apps/web/src/lib/services/reportExportService.ts`
- Modify: `apps/web/package.json` (dependencia html2canvas)

**Step 1: instalar html2canvas**

Desde la **raiz del repo** (`C:\Users\Usuario\Desktop\jostools`):

```
npx npm@10.9.0 install html2canvas --workspace apps/web
```

Verificar que `html2canvas` aparece en `apps/web/package.json` y que el diff de `package-lock.json` es pequeno (solo la entrada nueva). NO usar npm 11/12.

**Step 2: servicio PDF + Excel**

Crear `reportExportService.ts` con ambas funciones (PDF y Excel — la de Excel es Task 9 pero va en el mismo archivo):

```ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import type { ReportData } from "./reportService";
import { EVENT_TYPE_SHORT_LABELS, SYSTEM_CATEGORY_LABELS, EVENT_STATUS_LABELS, BLOCK_REASON_LABELS } from "@/types/maintenance";
import type { MaintenanceEvent } from "@/types/maintenance";

function shortDate(iso: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--" : d.toLocaleDateString("es-ES");
}

function lastFinalY(doc: jsPDF): number {
  const ref = doc as unknown as { lastAutoTable?: { finalY: number } };
  return ref.lastAutoTable?.finalY ?? 30;
}

function tableStyles() {
  return {
    styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" as const },
    headStyles: { fillColor: [35, 35, 40] as [number, number, number], textColor: 245, fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [244, 244, 245] as [number, number, number] },
    margin: { left: 14, right: 14 },
  };
}

function eventRow(e: MaintenanceEvent) {
  return [
    e.vehicle_id,
    EVENT_TYPE_SHORT_LABELS[e.event_type],
    shortDate(e.failure_timestamp),
    SYSTEM_CATEGORY_LABELS[e.system_category] ?? e.system_category,
    EVENT_STATUS_LABELS[e.status || "PENDING"],
    e.observation?.trim() || "--",
  ];
}

const EVENT_HEAD = ["Vehiculo", "Tipo", "Falla", "Sistema", "Estado", "Observacion"];

export async function exportReportToPdf(report: ReportData, conclusions: string, chartElements: (HTMLElement | null)[]): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setTextColor(30);
  doc.text("Informe Mensual de Mantenimiento e Infraestructura", 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${report.monthLabel} | Generado: ${new Date().toLocaleDateString("es-ES")}`, 14, 23);

  autoTable(doc, {
    startY: 29,
    head: [["Resumen del mes", "Valor"]],
    body: [
      ["Total de intervenciones", String(report.total)],
      ["Preventivos", `${report.preventive.length} (${report.preventivePct}%)`],
      ["Correctivos", `${report.corrective.length} (${report.correctivePct}%)`],
      ["Eficiencia de cierre", report.closureEfficiency != null ? `${report.closureEfficiency}%` : "--"],
      ["Cerrados en el mes", String(report.closedInMonth)],
      ["Backlog", String(report.backlog.length)],
      ["Costo total", `$${report.costTotal.toLocaleString("es-ES")}`],
      ["MTTR", report.indicators.mttr != null ? `${report.indicators.mttr.toFixed(1)} h` : "--"],
      ["MTBF", report.indicators.mtbf != null ? `${report.indicators.mtbf.toFixed(1)} h` : "--"],
      ["Disponibilidad", report.indicators.availability != null ? `${report.indicators.availability}%` : "--"],
    ],
    ...tableStyles(),
  });

  autoTable(doc, {
    startY: lastFinalY(doc) + 8,
    head: [["Seccion 1 - Preventivos, inspecciones y predictivos", ...EVENT_HEAD.slice(1)]],
    body: [...report.preventive, ...report.inspection, ...report.predictive].map(eventRow),
    ...tableStyles(),
  });

  autoTable(doc, {
    startY: lastFinalY(doc) + 8,
    head: [["Seccion 2 - Correctivos", ...EVENT_HEAD.slice(1)]],
    body: report.corrective.map(eventRow),
    ...tableStyles(),
  });

  autoTable(doc, {
    startY: lastFinalY(doc) + 8,
    head: [["Distribucion por flota", "Eventos"]],
    body: report.byFleetGroup.map((g) => [g.label, String(g.count)]),
    ...tableStyles(),
  });

  autoTable(doc, {
    startY: lastFinalY(doc) + 8,
    head: [["Distribucion por sistema", "Eventos"]],
    body: report.bySystem.map((g) => [g.label, String(g.count)]),
    ...tableStyles(),
  });

  autoTable(doc, {
    startY: lastFinalY(doc) + 8,
    head: [["Backlog", "Estado", "Motivo de bloqueo"]],
    body: report.backlog.map((e) => [
      e.vehicle_id,
      EVENT_STATUS_LABELS[e.status || "PENDING"],
      e.block_reason ? BLOCK_REASON_LABELS[e.block_reason] ?? e.block_reason : "Sin bloqueo",
    ]),
    ...tableStyles(),
  });

  let y = lastFinalY(doc) + 10;
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text("Conclusiones", 14, y);
  doc.setFontSize(9);
  doc.setTextColor(70);
  const lines = doc.splitTextToSize(conclusions, 182) as string[];
  lines.forEach((line) => {
    y += 5;
    if (y > 285) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 14, y);
  });

  for (const el of chartElements) {
    if (!el) continue;
    try {
      const canvas = await html2canvas(el, { backgroundColor: "#131315" });
      const img = canvas.toDataURL("image/png");
      const w = 182;
      const h = (canvas.height * w) / canvas.width;
      doc.addPage();
      doc.addImage(img, "PNG", 14, 20, w, Math.min(h, 250));
    } catch {
      el = null;
    }
  }

  doc.save(`Informe_${report.monthKey}.pdf`);
}

export function exportReportToExcel(report: ReportData, conclusions: string): void {
  const wb = XLSX.utils.book_new();

  const resumen = [
    { Dato: "Mes", Valor: report.monthLabel },
    { Dato: "Total intervenciones", Valor: report.total },
    { Dato: "Preventivos", Valor: `${report.preventive.length} (${report.preventivePct}%)` },
    { Dato: "Correctivos", Valor: `${report.corrective.length} (${report.correctivePct}%)` },
    { Dato: "Eficiencia de cierre", Valor: report.closureEfficiency != null ? `${report.closureEfficiency}%` : "--" },
    { Dato: "Cerrados en el mes", Valor: report.closedInMonth },
    { Dato: "Backlog", Valor: report.backlog.length },
    { Dato: "Costo total", Valor: report.costTotal },
    { Dato: "Conclusiones", Valor: conclusions },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen");

  const eventRows = (list: MaintenanceEvent[]) =>
    list.map((e) => ({
      Vehiculo: e.vehicle_id,
      Tipo: EVENT_TYPE_SHORT_LABELS[e.event_type],
      Falla: shortDate(e.failure_timestamp),
      Entrada: shortDate(e.workshop_entry_time),
      Salida: shortDate(e.workshop_exit_time),
      Horas: e.effective_work_hours ?? "",
      Sistema: SYSTEM_CATEGORY_LABELS[e.system_category] ?? e.system_category,
      Costo: e.repair_cost,
      Estado: EVENT_STATUS_LABELS[e.status || "PENDING"],
      Observacion: e.observation ?? "",
    }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventRows(report.preventive)), "Preventivos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventRows(report.corrective)), "Correctivos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.byFleetGroup.map((g) => ({ Flota: g.label, Eventos: g.count }))), "Flota");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.bySystem.map((g) => ({ Sistema: g.label, Eventos: g.count }))), "Sistema");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      report.backlog.map((e) => ({
        Vehiculo: e.vehicle_id,
        Estado: EVENT_STATUS_LABELS[e.status || "PENDING"],
        Motivo: e.block_reason ? BLOCK_REASON_LABELS[e.block_reason] ?? e.block_reason : "Sin bloqueo",
        Falla: shortDate(e.failure_timestamp),
      }))
    ),
    "Backlog"
  );

  XLSX.writeFile(wb, `Informe_${report.monthKey}.xlsx`);
}
```

Notas:
- El `catch` del loop de graficas deja el PDF sin esa grafica sin abortar (regla de diseno: html2canvas nunca bloquea el export).
- `EVENT_HEAD` se usa parcialmente (slice(1)); simplificar a arrays literales si se prefiere.

**Step 3: verificar**

Run: `npx tsc --noEmit` y `npm run build`
Expected: exit 0.

---

### Task 9: Navbar y ayuda

**Files:**
- Modify: `apps/web/src/components/Navbar.tsx:15-20`
- Modify: `apps/web/src/app/help/page.tsx`

**Step 1: enlace en Navbar**

En el array `links` (line ~15), despues de Registros:

```ts
const links = [
  { href: "/", label: "Dashboard" },
  { href: "/records", label: "Registros" },
  { href: "/reports", label: "Informe mensual" },
  { href: "/maintenance/new", label: "Nuevo registro" },
  { href: "/help", label: "Ayuda" },
];
```

**Step 2: seccion nueva en /help**

En el array `sections` de `help/page.tsx`, insertar un nuevo objeto **justo despues de la seccion `registros`** (line ~155-170) y antes de `dashboard`:

```ts
  {
    id: "informe-mensual",
    title: "Informe mensual",
    content:
      "El informe mensual genera automaticamente el mismo informe que antes se hacia a mano: resumen del mes, preventivos, correctivos, distribucion por flota y sistema, backlog y conclusiones. Se abre desde 'Informe mensual' en el navbar.",
    subsections: [
      {
        title: "Flujo",
        steps: [
          "Elige el mes en el selector de la parte superior; el informe se genera al instante.",
          "Revisa las tarjetas de resumen (total, % preventivo/correctivo, eficiencia de cierre, backlog, costo) y los indicadores del mes.",
          "Antes de generar la flota, usa 'Configurar flota' para asignar un grupo (MQ, VP-EP-VB-VC, VL-TP, Maquinaria, Carga pesada, Livianos) a cada vehiculo; los que no tengan grupo aparecen como 'Sin grupo'.",
          "Edita el parrafo de conclusiones si quieres; el texto que se ve es el que se exporta.",
          "Exporta con 'Exportar PDF' (incluye las graficas) o 'Exportar Excel' (hojas: Resumen, Preventivos, Correctivos, Flota, Sistema, Backlog).",
        ],
      },
      {
        title: "Como se calcula",
        items: [
          { name: "Eficiencia de cierre", desc: "Eventos cerrados en el mes / eventos que estuvieron en taller durante el mes x 100." },
          { name: "Backlog", desc: "Eventos abiertos o cerrados con motivo de bloqueo: todavia tienen trabajo pendiente." },
          { name: "Distribucion por flota", desc: "Eventos del mes agrupados por el campo 'Grupo de flota' del vehiculo (se asigna en 'Configurar flota' o al crear el vehiculo)." },
          { name: "Observaciones", desc: "El campo 'Observacion / Pendiente' de cada evento alimenta la columna de observaciones de las secciones 1 y 2." },
        ],
      },
    ],
  },
```

**Step 3: documentar los campos nuevos en secciones existentes**

- En la subseccion "Campos del formulario" (line ~98-110), agregar:

```ts
          { name: "Observacion / Pendiente", desc: "Nota libre del evento: repuestos faltantes, pendientes para la proxima intervencion. Se muestra en el detalle y en las secciones del Informe Mensual." },
```

- En la seccion "eventos-abiertos" (line ~143), agregar al final de su contenido/steps un item:

```ts
    items: [
      { name: "Motivo de bloqueo", desc: "En el detalle de un evento abierto puedes marcar por que esta detenido (falta repuesto, falta de pago, sin disponibilidad). Los bloqueados cuentan en el backlog del Informe Mensual y se marcan como 'Bloqueado' en la lista de registros. Al reabrir un evento el motivo se limpia." },
    ],
```

(Adaptar al shape real de esa seccion — revisar si usa `items` o `steps`; si no tiene `items`, agregarlo.)

**Step 4: verificar**

Run: `npx tsc --noEmit` y `npm run build`
Expected: exit 0.

---

### Task 10: Verificacion final y prueba manual

**Files:** ninguno (verificacion)

**Step 1: build completo**

Run (workdir `apps/web`): `npx tsc --noEmit; if ($?) { npm run build }`
Expected: exit 0, ruta `○ /reports` presente en la salida.

**Step 2: prueba manual (dev server)**

Run: `npm run dev` y en el navegador:
1. `/reports` carga desde el navbar, muestra "Configurar flota" con conteo de sin grupo
2. Asignar un grupo a un vehiculo → guardar → el contador baja
3. Elegir Septiembre 2026 (mes con eventos reales) → KPIs, secciones y graficas visibles
4. Editar conclusiones → Exportar PDF (descarga archivo con tablas + secciones de graficas) y Exportar Excel (6 hojas)
5. `/maintenance/new` → campo "Observacion / Pendiente" presente y se guarda
6. Abrir un evento abierto → selector "Motivo de bloqueo" en el detalle; al elegirlo aparece badge "Bloqueado" en `/records` y cambia el backlog del informe
7. Editar un evento (agregar observacion) → en el detalle aparece badge "Editado" con el campo Observation en el historial
8. Cerrar y reabrir un evento → el motivo de bloqueo se limpia
9. `/help` → seccion "Informe mensual" en el TOC y campos nuevos documentados

**Step 3: pedir permiso de commit**

Preguntar al usuario: "Verificacion OK. Quieres que commitee todo el trabajo acumulado hacia develop?" — **NO commitear sin su respuesta afirmativa.**

---

## Resumen de orden de ejecucion

1. Task 1 (types) → 2 (vehicle) → 3 (form alta) → 4 (detalle/edicion/lista/reabrir)
2. Task 8 primero (servicio + html2canvas) o Task 5-8 juntos, porque Task 7 importa `reportExportService`
3. Task 5 (reportService) → 6 (FleetGroupConfig) → 7 (pagina /reports)
4. Task 9 (Navbar + help) → 10 (verificacion + permiso de commit)

Entre bloques: `npx tsc --noEmit` siempre; `npm run build` tras tasks 4, 8, 7 y al final.
