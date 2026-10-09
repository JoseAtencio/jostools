# Kardex de Gasoil (Fase 2) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reemplazar el Excel CONTROL DE GASOIL con un modulo de kardex en JosTools: alta de movimientos con campos condicionales por categoria, saldo automatico, cierre mensual computado y exports Excel + PDF.

**Architecture:** Pagina client-side `/combustible` (patron /records y /reports) con coleccion nueva `fuel_movements`, config de saldo inicial en `fuel_config/{enterpriseId}`, helpers puros de saldo/cierre en `fuelKardexService`, y exports en `fuelExportService` reutilizando xlsx + jspdf/autotable.

**Tech Stack:** Next.js 16 App Router, Firebase Firestore modular SDK, xlsx, jspdf + jspdf-autotable, Tailwind inline styles con CSS vars (graphite/tuscan-sun/raspberry-red/ash-grey/crayola-blue).

**Design doc:** `docs/plans/2026-10-08-kardex-gasoil-design.md` (aprobado).

**Convenciones del repo (STRICT):** acentos prohibidos en UI/cadenas ("Vehiculo", "Observacion"), NO comentarios de codigo, NO emojis, estilos inline con CSS vars, HelpTip tooltips, badges rounded-full. Verificacion = `npx tsc --noEmit` + `npm run build` (workdir `apps/web`). NO framework de tests. **NUNCA git add/commit/stage sin permiso explicito del usuario.**

---

### Task 1: Types de fuel

**Files:**
- Create: `apps/web/src/types/fuel.ts`

**Step 1: crear el archivo completo**

```ts
export type FuelMovementTipo = "entrada" | "salida";
export type FuelCategory = "interno" | "planta" | "sindicato" | "tercero" | "compra";

export const FUEL_CATEGORIES: FuelCategory[] = ["interno", "planta", "sindicato", "tercero", "compra"];

export const FUEL_CATEGORY_LABELS: Record<FuelCategory, string> = {
  interno: "Interno (flota/obra)",
  planta: "Planta (despacho asfalto)",
  sindicato: "Sindicato",
  tercero: "Terceros",
  compra: "Compra (ingreso)",
};

export const FUEL_TIPO_LABELS: Record<FuelMovementTipo, string> = {
  entrada: "Ingreso",
  salida: "Egreso",
};

export const DEFAULT_T_L = 1.5;

export interface FuelMovementInput {
  enterpriseId: string;
  fecha: string;
  tipo: FuelMovementTipo;
  categoria: FuelCategory;
  litros: number;
  vehicle_id?: string;
  obra?: string;
  toneladas?: number;
  t_l?: number;
  chofer?: string;
  ci?: string;
  placa?: string;
  talonario?: string;
  proveedor?: string;
  nro_control?: string;
  nro_factura?: string;
  soporte?: string;
  nota?: string;
}

export interface FuelMovement extends FuelMovementInput {
  id: string;
  created_at: string;
  updated_at?: string;
}

export interface FuelCierre {
  previa: number;
  ingresos: number;
  consumo: number;
  existencia: number;
  porCategoria: { interno: number; planta: number; sindicato: number; tercero: number };
  movementsInMonth: FuelMovement[];
}

export function categoriaTipo(categoria: FuelCategory): FuelMovementTipo {
  return categoria === "compra" ? "entrada" : "salida";
}
```

**Step 2: verificar**

Run: `npx tsc --noEmit`
Expected: exit 0.

---

### Task 2: fuelKardexService (CRUD + config + helpers puros)

**Files:**
- Create: `apps/web/src/lib/services/fuelKardexService.ts`

**Step 1: crear el servicio completo**

```ts
import { collection, addDoc, getDocs, query, where, Timestamp, doc, updateDoc, getDoc, setDoc, deleteDoc } from "@firebase/firestore";
import { db } from "@jostools/firebase-config";
import type { FuelMovement, FuelMovementInput, FuelCierre } from "@/types/fuel";

const fuelRef = collection(db, "jostools", "config", "fuel_movements");
const fuelConfigRef = collection(db, "jostools", "config", "fuel_config");

function toISOString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "toDate" in val) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function buildPayload(data: FuelMovementInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    enterpriseId: data.enterpriseId,
    fecha: Timestamp.fromDate(new Date(data.fecha)),
    tipo: data.tipo,
    categoria: data.categoria,
    litros: Number(data.litros) || 0,
  };
  const optional: (keyof FuelMovementInput)[] = [
    "vehicle_id", "obra", "toneladas", "t_l", "chofer", "ci", "placa",
    "talonario", "proveedor", "nro_control", "nro_factura", "soporte", "nota",
  ];
  for (const key of optional) {
    const value = data[key];
    if (value !== undefined && value !== null && value !== "") payload[key] = value;
  }
  return payload;
}

function toMovement(id: string, data: Record<string, unknown>): FuelMovement {
  return {
    id,
    enterpriseId: String(data.enterpriseId ?? ""),
    fecha: toISOString(data.fecha),
    tipo: data.tipo === "entrada" ? "entrada" : "salida",
    categoria: (data.categoria ?? "interno") as FuelMovement["categoria"],
    litros: Number(data.litros) || 0,
    vehicle_id: (data.vehicle_id as string) || undefined,
    obra: (data.obra as string) || undefined,
    toneladas: data.toneladas != null ? Number(data.toneladas) : undefined,
    t_l: data.t_l != null ? Number(data.t_l) : undefined,
    chofer: (data.chofer as string) || undefined,
    ci: (data.ci as string) || undefined,
    placa: (data.placa as string) || undefined,
    talonario: (data.talonario as string) || undefined,
    proveedor: (data.proveedor as string) || undefined,
    nro_control: (data.nro_control as string) || undefined,
    nro_factura: (data.nro_factura as string) || undefined,
    soporte: (data.soporte as string) || undefined,
    nota: (data.nota as string) || undefined,
    created_at: toISOString(data.created_at),
    updated_at: data.updated_at ? toISOString(data.updated_at) : undefined,
  };
}

export async function createFuelMovement(data: FuelMovementInput): Promise<string> {
  const docRef = await addDoc(fuelRef, { ...buildPayload(data), created_at: Timestamp.now() });
  return docRef.id;
}

export async function getFuelMovements(enterpriseId: string): Promise<FuelMovement[]> {
  const q = query(fuelRef, where("enterpriseId", "==", enterpriseId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => toMovement(d.id, d.data()))
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
}

export async function updateFuelMovement(id: string, data: FuelMovementInput): Promise<void> {
  await updateDoc(doc(fuelRef, id), { ...buildPayload(data), updated_at: Timestamp.now() });
}

export async function deleteFuelMovement(id: string): Promise<void> {
  await deleteDoc(doc(fuelRef, id));
}

export async function getFuelInitialLiters(enterpriseId: string): Promise<number> {
  const snap = await getDoc(doc(fuelConfigRef, enterpriseId));
  if (!snap.exists()) return 0;
  return Number(snap.data().initial_liters) || 0;
}

export async function saveFuelInitialLiters(enterpriseId: string, initialLiters: number): Promise<void> {
  await setDoc(doc(fuelConfigRef, enterpriseId), { enterpriseId, initial_liters: Number(initialLiters) || 0 }, { merge: true });
}

export function balanceOf(movements: FuelMovement[], initialLiters: number): { existencia: number; ingresos: number; consumo: number } {
  const ingresos = movements.filter((m) => m.tipo === "entrada").reduce((s, m) => s + m.litros, 0);
  const consumo = movements.filter((m) => m.tipo === "salida").reduce((s, m) => s + m.litros, 0);
  return { existencia: initialLiters + ingresos - consumo, ingresos, consumo };
}

export function cierreOf(movements: FuelMovement[], initialLiters: number, monthKey: string): FuelCierre {
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const previa = initialLiters + movements
    .filter((m) => new Date(m.fecha) < monthStart)
    .reduce((s, m) => s + (m.tipo === "entrada" ? m.litros : -m.litros), 0);
  const movementsInMonth = movements.filter((m) => {
    const d = new Date(m.fecha);
    return d >= monthStart && d < monthEnd;
  });
  const ingresos = movementsInMonth.filter((m) => m.tipo === "entrada").reduce((s, m) => s + m.litros, 0);
  const consumo = movementsInMonth.filter((m) => m.tipo === "salida").reduce((s, m) => s + m.litros, 0);
  const porCategoria = { interno: 0, planta: 0, sindicato: 0, tercero: 0 };
  for (const m of movementsInMonth) {
    if (m.tipo !== "salida") continue;
    if (m.categoria === "interno" || m.categoria === "planta" || m.categoria === "sindicato" || m.categoria === "tercero") {
      porCategoria[m.categoria] += m.litros;
    }
  }
  return { previa, ingresos, consumo, existencia: previa + ingresos - consumo, porCategoria, movementsInMonth };
}

export function litrosPorDia(consumo: number, monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  const now = new Date();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  let days: number;
  if (now >= monthStart && now < monthEnd) {
    days = Math.max(1, now.getDate());
  } else {
    days = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86400000);
  }
  return days > 0 ? Math.round(consumo / days) : 0;
}

export function monthKeyOfFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabelOfKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  const label = new Date(year, month - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function getFuelMonthOptions(movements: FuelMovement[]): string[] {
  const keys = new Set(movements.map((m) => monthKeyOfFecha(m.fecha)));
  const current = monthKeyOfFecha(new Date().toISOString());
  keys.add(current);
  return Array.from(keys).sort().reverse();
}
```

**Step 2: verificar**

Run: `npx tsc --noEmit`
Expected: exit 0.

---

### Task 3: FuelMovementModal (alta/edicion con campos condicionales)

**Files:**
- Create: `apps/web/src/components/FuelMovementModal.tsx`

**Step 1: crear el modal completo**

Patron visual de `CloseEventModal` (overlay fixed + card). Campos condicionales por categoria; en planta `litros = toneladas x t_l` se calcula en vivo y el input de litros se oculta.

```tsx
"use client";

import { useState } from "react";
import HelpTip from "@/components/HelpTip";
import VehicleCombobox from "@/components/VehicleCombobox";
import { useAppSelector } from "@/lib/redux/hooks";
import { createFuelMovement, updateFuelMovement } from "@/lib/services/fuelKardexService";
import { FUEL_CATEGORIES, FUEL_CATEGORY_LABELS, categoriaTipo, DEFAULT_T_L, type FuelCategory, type FuelMovement } from "@/types/fuel";

interface FuelMovementModalProps {
  movement?: FuelMovement | null;
  onClose: () => void;
  onSaved: () => void;
}

const inputStyle = {
  backgroundColor: "var(--graphite-800)",
  border: "1px solid var(--graphite-600)",
  color: "var(--graphite-100)",
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function FuelMovementModal({ movement, onClose, onSaved }: FuelMovementModalProps) {
  const { user } = useAppSelector((state) => state.auth);
  const [categoria, setCategoria] = useState<FuelCategory>(movement?.categoria ?? "interno");
  const [fecha, setFecha] = useState(movement ? movement.fecha.slice(0, 10) : todayISO());
  const [litros, setLitros] = useState(movement && movement.categoria !== "planta" ? String(movement.litros) : "");
  const [toneladas, setToneladas] = useState(movement?.toneladas != null ? String(movement.toneladas) : "");
  const [tL, setTL] = useState(movement?.t_l != null ? String(movement.t_l) : String(DEFAULT_T_L));
  const [vehicleId, setVehicleId] = useState(movement?.vehicle_id ?? "");
  const [obra, setObra] = useState(movement?.obra ?? "");
  const [chofer, setChofer] = useState(movement?.chofer ?? "");
  const [ci, setCi] = useState(movement?.ci ?? "");
  const [placa, setPlaca] = useState(movement?.placa ?? "");
  const [talonario, setTalonario] = useState(movement?.talonario ?? "");
  const [proveedor, setProveedor] = useState(movement?.proveedor ?? "");
  const [nroControl, setNroControl] = useState(movement?.nro_control ?? "");
  const [nroFactura, setNroFactura] = useState(movement?.nro_factura ?? "");
  const [soporte, setSoporte] = useState(movement?.soporte ?? "");
  const [nota, setNota] = useState(movement?.nota ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isPlanta = categoria === "planta";
  const litrosCalculados = isPlanta ? (parseFloat(toneladas) || 0) * (parseFloat(tL) || 0) : 0;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!fecha) errs.fecha = "La fecha es obligatoria.";
    if (isPlanta) {
      if (!(parseFloat(toneladas) > 0)) errs.toneladas = "Indique las toneladas despachadas.";
      if (!(parseFloat(tL) > 0)) errs.t_l = "El factor T/L debe ser mayor a cero.";
    } else if (!(parseFloat(litros) > 0)) {
      errs.litros = "Los litros deben ser mayor a cero.";
    }
    if (categoria === "interno" && !vehicleId.trim()) errs.vehicle_id = "Seleccione el vehiculo.";
    if (categoria === "sindicato" && !chofer.trim()) errs.chofer = "Indique el chofer.";
    if (categoria === "tercero" && !placa.trim()) errs.placa = "Indique la placa.";
    if (categoria === "compra" && !proveedor.trim()) errs.proveedor = "Indique el proveedor.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.enterpriseId || saving) return;
    if (!validate()) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        enterpriseId: user.enterpriseId,
        fecha: new Date(`${fecha}T12:00:00`).toISOString(),
        tipo: categoriaTipo(categoria),
        categoria,
        litros: isPlanta ? Math.round(litrosCalculados * 100) / 100 : parseFloat(litros) || 0,
        vehicle_id: categoria === "interno" ? vehicleId.trim() : undefined,
        obra: obra.trim() || undefined,
        toneladas: isPlanta ? parseFloat(toneladas) || undefined : undefined,
        t_l: isPlanta ? parseFloat(tL) || undefined : undefined,
        chofer: categoria === "sindicato" ? chofer.trim() || undefined : undefined,
        ci: categoria === "sindicato" ? ci.trim() || undefined : undefined,
        placa: categoria === "sindicato" || categoria === "tercero" ? placa.trim() || undefined : undefined,
        talonario: categoria === "tercero" ? talonario.trim() || undefined : undefined,
        proveedor: categoria === "compra" ? proveedor.trim() || undefined : undefined,
        nro_control: categoria === "compra" ? nroControl.trim() || undefined : undefined,
        nro_factura: categoria === "compra" ? nroFactura.trim() || undefined : undefined,
        soporte: (categoria === "interno" || categoria === "tercero") ? soporte.trim() || undefined : undefined,
        nota: nota.trim() || undefined,
      };
      if (movement) {
        await updateFuelMovement(movement.id, payload);
      } else {
        await createFuelMovement(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el movimiento");
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (name: string) =>
    fieldErrors[name] ? <p className="text-xs mt-1" style={{ color: "var(--raspberry-red-400)" }}>{fieldErrors[name]}</p> : null;

  const labelClass = "block text-sm font-medium mb-2";
  const labelStyle = { color: "var(--graphite-300)" };
  const inputClass = "w-full px-3 py-2 rounded-xl text-sm focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="rounded-2xl border w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4" style={{ color: "var(--graphite-100)" }}>
          {movement ? "Editar movimiento" : "Nuevo movimiento"}
          <HelpTip title="Movimiento de gasoil" text="Registra una entrada (compra) o una salida (egreso). La categoria define los campos: interno es flota propia, planta es despacho de asfalto en toneladas, sindicato y terceros son entregas fuera del catalogo, compra es ingreso de combustible." />
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>Categoria *</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value as FuelCategory)} disabled={!!movement} className={`${inputClass} cursor-pointer`} style={inputStyle}>
                {FUEL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{FUEL_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              {movement && <p className="text-xs mt-1" style={{ color: "var(--graphite-500)" }}>La categoria no se puede cambiar al editar.</p>}
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Fecha *</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} style={inputStyle} />
              {fieldError("fecha")}
            </div>
          </div>

          {categoria === "interno" && (
            <div>
              <label className={labelClass} style={labelStyle}>Vehiculo *</label>
              <VehicleCombobox value={vehicleId} onChange={setVehicleId} enterpriseId={user?.enterpriseId ?? null} placeholder="Ej: ABC-123" name="vehicle_id" />
              {fieldError("vehicle_id")}
            </div>
          )}

          {categoria === "planta" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass} style={labelStyle}>Toneladas *</label>
                <input type="number" step="0.01" min="0" value={toneladas} onChange={(e) => setToneladas(e.target.value)} className={inputClass} style={inputStyle} />
                {fieldError("toneladas")}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>T/L *</label>
                <input type="number" step="0.01" min="0" value={tL} onChange={(e) => setTL(e.target.value)} className={inputClass} style={inputStyle} />
                {fieldError("t_l")}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Litros</label>
                <input type="text" readOnly value={litrosCalculados > 0 ? litrosCalculados.toFixed(2) : "--"} className={inputClass} style={{ ...inputStyle, color: "var(--tuscan-sun-400)" }} />
              </div>
            </div>
          )}

          {!isPlanta && (
            <div>
              <label className={labelClass} style={labelStyle}>Litros *</label>
              <input type="number" step="0.01" min="0" value={litros} onChange={(e) => setLitros(e.target.value)} className={inputClass} style={inputStyle} />
              {fieldError("litros")}
            </div>
          )}

          {categoria === "sindicato" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass} style={labelStyle}>Chofer *</label>
                <input type="text" value={chofer} onChange={(e) => setChofer(e.target.value)} className={inputClass} style={inputStyle} />
                {fieldError("chofer")}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>C.I.</label>
                <input type="text" value={ci} onChange={(e) => setCi(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Placas</label>
                <input type="text" value={placa} onChange={(e) => setPlaca(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            </div>
          )}

          {categoria === "tercero" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} style={labelStyle}>Placa *</label>
                <input type="text" value={placa} onChange={(e) => setPlaca(e.target.value)} className={inputClass} style={inputStyle} />
                {fieldError("placa")}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Nro Talonario</label>
                <input type="text" value={talonario} onChange={(e) => setTalonario(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            </div>
          )}

          {categoria === "compra" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass} style={labelStyle}>Proveedor *</label>
                <input type="text" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={inputClass} style={inputStyle} />
                {fieldError("proveedor")}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Nro Control</label>
                <input type="text" value={nroControl} onChange={(e) => setNroControl(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Nro Factura</label>
                <input type="text" value={nroFactura} onChange={(e) => setNroFactura(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {(categoria === "interno" || categoria === "planta") && (
              <div>
                <label className={labelClass} style={labelStyle}>Obra</label>
                <input type="text" value={obra} onChange={(e) => setObra(e.target.value)} placeholder="Ej: PATIO" className={inputClass} style={inputStyle} />
              </div>
            )}
            {(categoria === "interno" || categoria === "tercero") && (
              <div>
                <label className={labelClass} style={labelStyle}>Soporte (Nro factura)</label>
                <input type="text" value={soporte} onChange={(e) => setSoporte(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            )}
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>Nota</label>
            <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} className={inputClass} style={inputStyle} />
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>
              {saving ? "Guardando..." : movement ? "Guardar cambios" : "Registrar movimiento"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-300)" }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: verificar**

Run: `npx tsc --noEmit`
Expected: exit 0.

---

### Task 4: fuelExportService (Excel + PDF)

**Files:**
- Create: `apps/web/src/lib/services/fuelExportService.ts`

**Step 1: crear el servicio completo**

```ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { FuelMovement, FuelCierre } from "@/types/fuel";
import { FUEL_CATEGORY_LABELS, FUEL_TIPO_LABELS } from "@/types/fuel";
import { monthLabelOfKey } from "./fuelKardexService";

function shortDate(iso: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--" : d.toLocaleDateString("es-ES");
}

function destinoOf(m: FuelMovement, vehicleLabel: (id: string) => string): string {
  if (m.categoria === "interno") return vehicleLabel(m.vehicle_id || "");
  if (m.categoria === "planta") return `Despacho asfalto (${m.toneladas ?? 0} ton x ${m.t_l ?? 0})`;
  if (m.categoria === "sindicato") return [m.chofer, m.placa ? `placa ${m.placa}` : ""].filter(Boolean).join(" - ") || "--";
  if (m.categoria === "tercero") return m.placa ? `Placa ${m.placa}` : "--";
  return m.proveedor || "--";
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

function movementRow(m: FuelMovement, vehicleLabel: (id: string) => string) {
  return [
    shortDate(m.fecha),
    FUEL_TIPO_LABELS[m.tipo],
    FUEL_CATEGORY_LABELS[m.categoria],
    destinoOf(m, vehicleLabel),
    m.obra || "--",
    m.litros.toLocaleString("es-ES"),
    m.soporte || m.nro_factura || "--",
  ];
}

export function exportFuelToExcel(cierre: FuelCierre, monthKey: string, movementsInMonth: FuelMovement[], vehicleLabel: (id: string) => string): void {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Dato: "Mes", Valor: monthLabelOfKey(monthKey) },
      { Dato: "Existencia previa", Valor: cierre.previa },
      { Dato: "Ingresos (compras)", Valor: cierre.ingresos },
      { Dato: "Interno (flota/obra)", Valor: cierre.porCategoria.interno },
      { Dato: "Despacho planta", Valor: cierre.porCategoria.planta },
      { Dato: "Sindicato", Valor: cierre.porCategoria.sindicato },
      { Dato: "Terceros", Valor: cierre.porCategoria.tercero },
      { Dato: "Consumo total", Valor: cierre.consumo },
      { Dato: "Existencia final", Valor: cierre.existencia },
    ]),
    "Cierre"
  );

  const byCategoria = (cat: FuelMovement["categoria"]) => movementsInMonth.filter((m) => m.categoria === cat);

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      byCategoria("interno").map((m) => ({
        Fecha: shortDate(m.fecha),
        Vehiculo: vehicleLabel(m.vehicle_id || ""),
        Obra: m.obra || "",
        Litros: m.litros,
        Soporte: m.soporte || "",
      }))
    ),
    "Interno"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      byCategoria("planta").map((m) => ({
        Fecha: shortDate(m.fecha),
        Toneladas: m.toneladas ?? 0,
        "T/L": m.t_l ?? 0,
        Litros: m.litros,
        Obra: m.obra || "",
      }))
    ),
    "Planta"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      byCategoria("sindicato").map((m) => ({
        Fecha: shortDate(m.fecha),
        Chofer: m.chofer || "",
        "C.I.": m.ci || "",
        Placas: m.placa || "",
        "Nro Factura": m.nro_factura || "",
        Litros: m.litros,
      }))
    ),
    "Sindicato"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      byCategoria("tercero").map((m) => ({
        Fecha: shortDate(m.fecha),
        Placa: m.placa || "",
        Litros: m.litros,
        Soporte: m.soporte || "",
        Talonario: m.talonario || "",
      }))
    ),
    "Terceros"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      byCategoria("compra").map((m) => ({
        Fecha: shortDate(m.fecha),
        Proveedor: m.proveedor || "",
        "Nro Control": m.nro_control || "",
        "Nro Factura": m.nro_factura || "",
        Litros: m.litros,
      }))
    ),
    "Ingresos"
  );

  XLSX.writeFile(wb, `Kardex_Gasoil_${monthKey}.xlsx`);
}

export function exportFuelToPdf(cierre: FuelCierre, monthKey: string, movementsInMonth: FuelMovement[], vehicleLabel: (id: string) => string): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setTextColor(30);
  doc.text("Kardex de Gasoil", 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${monthLabelOfKey(monthKey)} | Generado: ${new Date().toLocaleDateString("es-ES")}`, 14, 23);

  autoTable(doc, {
    startY: 29,
    head: [["Cierre del mes", "Litros"]],
    body: [
      ["Existencia previa", cierre.previa.toLocaleString("es-ES")],
      ["Ingresos (compras)", cierre.ingresos.toLocaleString("es-ES")],
      ["Interno (flota/obra)", cierre.porCategoria.interno.toLocaleString("es-ES")],
      ["Despacho planta", cierre.porCategoria.planta.toLocaleString("es-ES")],
      ["Sindicato", cierre.porCategoria.sindicato.toLocaleString("es-ES")],
      ["Terceros", cierre.porCategoria.tercero.toLocaleString("es-ES")],
      ["Consumo total", cierre.consumo.toLocaleString("es-ES")],
      ["Existencia final", cierre.existencia.toLocaleString("es-ES")],
    ],
    ...tableStyles(),
  });

  let titleY = lastFinalY(doc) + 10;
  if (titleY > 265) {
    doc.addPage();
    titleY = 20;
  }
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text(`Movimientos del mes (${movementsInMonth.length})`, 14, titleY);

  autoTable(doc, {
    startY: titleY + 5,
    head: [["Fecha", "Tipo", "Categoria", "Vehiculo / Destino", "Obra", "Litros", "Soporte"]],
    body: movementsInMonth.map((m) => movementRow(m, vehicleLabel)),
    ...tableStyles(),
  });

  doc.save(`Kardex_Gasoil_${monthKey}.pdf`);
}
```

**Step 2: verificar**

Run: `npx tsc --noEmit`
Expected: exit 0.

---

### Task 5: Pagina /combustible

**Files:**
- Create: `apps/web/src/app/combustible/page.tsx`

**Step 1: crear la pagina completa**

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import HelpTip from "@/components/HelpTip";
import FuelMovementModal from "@/components/FuelMovementModal";
import { useAppSelector } from "@/lib/redux/hooks";
import { getVehicles } from "@/lib/services/vehicleService";
import type { Vehicle } from "@/types/vehicle";
import {
  getFuelMovements, getFuelInitialLiters, saveFuelInitialLiters, deleteFuelMovement,
  balanceOf, cierreOf, litrosPorDia, monthLabelOfKey, getFuelMonthOptions,
} from "@/lib/services/fuelKardexService";
import { exportFuelToExcel, exportFuelToPdf } from "@/lib/services/fuelExportService";
import { FUEL_CATEGORIES, FUEL_CATEGORY_LABELS, FUEL_TIPO_LABELS, type FuelCategory, type FuelMovement } from "@/types/fuel";

const kpiCard = (label: string, value: string, help: string) => (
  <div key={label} className="rounded-2xl border p-4" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
    <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--graphite-500)" }}>
      {label}
      <HelpTip title={label} text={help} />
    </p>
    <p className="text-xl font-bold" style={{ color: "var(--graphite-100)" }}>{value}</p>
  </div>
);

const categoriaBadgeColor: Record<FuelCategory, string> = {
  interno: "var(--graphite-300)",
  planta: "var(--tuscan-sun-400)",
  sindicato: "var(--crayola-blue-400)",
  tercero: "var(--raspberry-red-400)",
  compra: "var(--ash-grey-400)",
};

export default function CombustiblePage() {
  const { user } = useAppSelector((state) => state.auth);
  const [movements, setMovements] = useState<FuelMovement[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [initialLiters, setInitialLiters] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthKey, setMonthKey] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [filterVehiculo, setFilterVehiculo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FuelMovement | null>(null);
  const [deleting, setDeleting] = useState<FuelMovement | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  const loadData = () => {
    if (!user?.enterpriseId) return;
    Promise.all([
      getFuelMovements(user.enterpriseId),
      getVehicles(user.enterpriseId),
      getFuelInitialLiters(user.enterpriseId),
    ])
      .then(([movs, vehs, initial]) => {
        setMovements(movs);
        setVehicles(vehs);
        setInitialLiters(initial);
        setConfigDraft(String(initial));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError("No se pudo cargar el kardex de gasoil.");
      });
  };

  useEffect(() => { loadData(); }, [user?.enterpriseId]);

  const monthOptions = useMemo(() => getFuelMonthOptions(movements), [movements]);

  useEffect(() => {
    if (monthOptions.length > 0 && !monthKey) setMonthKey(monthOptions[0]);
  }, [monthOptions, monthKey]);

  const vehicleLabel = useMemo(() => {
    const map = new Map(vehicles.map((v) => [v.vehicle_id, v.name || v.vehicle_id]));
    return (id: string) => map.get(id) || id || "--";
  }, [vehicles]);

  const cierre = useMemo(() => cierreOf(movements, initialLiters, monthKey || monthOptions[0] || ""), [movements, initialLiters, monthKey, monthOptions]);

  const filtered = useMemo(() => {
    return cierre.movementsInMonth.filter((m) => {
      if (filterCategoria && m.categoria !== filterCategoria) return false;
      if (filterVehiculo && m.vehicle_id !== filterVehiculo) return false;
      return true;
    });
  }, [cierre, filterCategoria, filterVehiculo]);

  const balance = useMemo(() => balanceOf(movements, initialLiters), [movements, initialLiters]);
  const porDia = useMemo(() => litrosPorDia(cierre.consumo, monthKey || monthOptions[0] || ""), [cierre, monthKey, monthOptions]);

  const destinoOf = (m: FuelMovement): string => {
    if (m.categoria === "interno") return vehicleLabel(m.vehicle_id || "");
    if (m.categoria === "planta") return `Despacho asfalto (${m.toneladas ?? 0} ton x ${m.t_l ?? 0})`;
    if (m.categoria === "sindicato") return [m.chofer, m.placa ? `placa ${m.placa}` : ""].filter(Boolean).join(" - ") || "--";
    if (m.categoria === "tercero") return m.placa ? `Placa ${m.placa}` : "--";
    return m.proveedor || "--";
  };

  const handleSaveConfig = async () => {
    if (!user?.enterpriseId || savingConfig) return;
    setSavingConfig(true);
    try {
      const value = parseFloat(configDraft) || 0;
      await saveFuelInitialLiters(user.enterpriseId, value);
      setInitialLiters(value);
      setShowConfig(false);
    } catch {
      alert("No se pudo guardar la existencia inicial");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteFuelMovement(deleting.id);
      setDeleting(null);
      loadData();
    } catch {
      alert("No se pudo borrar el movimiento");
    }
  };

  const monthLabel = monthLabelOfKey(monthKey || monthOptions[0] || "");

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: "var(--graphite-950)" }}>
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h1 className="text-2xl font-bold" style={{ color: "var(--graphite-100)" }}>
              Control de gasoil
              <HelpTip title="Kardex de gasoil" text="Entradas y salidas de combustible con saldo automatico. Reemplaza el Excel CONTROL DE GASOIL: registra movimientos por categoria y el sistema calcula la existencia y el cierre del mes." />
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <select value={monthKey} onChange={(e) => setMonthKey(e.target.value)} className="px-4 py-2 rounded-xl text-sm outline-none cursor-pointer" style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{monthLabelOfKey(m)}</option>
                ))}
              </select>
              <button onClick={() => setShowConfig(!showConfig)} className="px-3 py-2 rounded-xl text-sm cursor-pointer" style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-300)" }}>
                Existencia inicial
              </button>
              <button onClick={() => { setEditing(null); setModalOpen(true); }} className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>
                + Nuevo movimiento
              </button>
              <button onClick={() => { if (monthKey) exportFuelToPdf(cierre, monthKey, cierre.movementsInMonth, vehicleLabel); }} disabled={!monthKey} className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: "rgba(0, 81, 255, 0.15)", color: "var(--crayola-blue-400)", border: "1px solid rgba(0, 81, 255, 0.3)" }}>
                Exportar PDF
              </button>
              <button onClick={() => { if (monthKey) exportFuelToExcel(cierre, monthKey, cierre.movementsInMonth, vehicleLabel); }} disabled={!monthKey} className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: "rgba(102, 153, 145, 0.15)", color: "var(--ash-grey-400)", border: "1px solid rgba(102, 153, 145, 0.3)" }}>
                Exportar Excel
              </button>
            </div>
          </div>

          {showConfig && (
            <div className="mb-6 p-4 rounded-2xl border flex items-end gap-3 flex-wrap" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--graphite-400)" }}>
                  Existencia inicial (litros)
                  <HelpTip title="Existencia inicial" text="Saldo de gasoil con el que arranca el kardex. Cargalo una sola vez con la existencia previa del ultimo cierre del Excel; despues el sistema arrastra el saldo solo." />
                </label>
                <input type="number" step="0.01" min="0" value={configDraft} onChange={(e) => setConfigDraft(e.target.value)} className="px-3 py-2 rounded-xl text-sm w-48 focus:outline-none" style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-100)" }} />
              </div>
              <button onClick={handleSaveConfig} disabled={savingConfig} className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>
                {savingConfig ? "Guardando..." : "Guardar"}
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-20" style={{ color: "var(--graphite-500)" }}>Cargando kardex...</div>
          ) : error ? (
            <div className="text-center py-20 rounded-xl" style={{ color: "var(--raspberry-red-400)", border: "1px solid var(--graphite-800)", backgroundColor: "var(--graphite-900)" }}>
              {error}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {kpiCard("Existencia actual", `${balance.existencia.toLocaleString("es-ES")} L`, "Saldo inicial mas ingresos menos egresos de todos los movimientos registrados.")}
                {kpiCard("Ingresos del mes", `${cierre.ingresos.toLocaleString("es-ES")} L`, "Litros comprados e ingresados en el mes seleccionado.")}
                {kpiCard("Consumo del mes", `${cierre.consumo.toLocaleString("es-ES")} L`, "Litros egresados en el mes seleccionado (interno, planta, sindicato y terceros).")}
                {kpiCard("Litros por dia", `${porDia.toLocaleString("es-ES")} L/dia`, "Consumo del mes dividido entre los dias transcurridos.")}
              </div>

              <div className="mb-6 p-5 rounded-2xl border" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h2 className="text-lg font-bold" style={{ color: "var(--graphite-100)" }}>Cierre de {monthLabel}</h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium" style={{
                    backgroundColor: cierre.existencia >= 0 ? "rgba(102, 153, 145, 0.15)" : "rgba(224, 31, 95, 0.15)",
                    color: cierre.existencia >= 0 ? "var(--ash-grey-400)" : "var(--raspberry-red-400)",
                  }}>
                    {cierre.existencia >= 0 ? "Cuadrado" : "Existencia negativa"}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                  {[
                    ["Existencia previa", cierre.previa],
                    ["Ingresos (compras)", cierre.ingresos],
                    ["Interno", cierre.porCategoria.interno],
                    ["Planta", cierre.porCategoria.planta],
                    ["Sindicato", cierre.porCategoria.sindicato],
                    ["Terceros", cierre.porCategoria.tercero],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl p-3" style={{ backgroundColor: "var(--graphite-950)", border: "1px solid var(--graphite-800)" }}>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--graphite-500)" }}>{label}</p>
                      <p className="text-base font-bold mt-0.5" style={{ color: "var(--graphite-100)" }}>{Number(value).toLocaleString("es-ES")} L</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm" style={{ color: "var(--graphite-400)" }}>
                  {cierre.previa.toLocaleString("es-ES")} + {cierre.ingresos.toLocaleString("es-ES")} - {cierre.consumo.toLocaleString("es-ES")} = <span className="font-bold" style={{ color: "var(--tuscan-sun-400)" }}>{cierre.existencia.toLocaleString("es-ES")} L</span>
                </p>
              </div>

              <div className="mb-4 flex items-center gap-3 flex-wrap">
                <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer" style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}>
                  <option value="">Categoria: Todas</option>
                  {FUEL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{FUEL_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
                <select value={filterVehiculo} onChange={(e) => setFilterVehiculo(e.target.value)} className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer" style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}>
                  <option value="">Vehiculo: Todos</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.vehicle_id}>{v.name || v.vehicle_id}</option>
                  ))}
                </select>
                {(filterCategoria || filterVehiculo) && (
                  <button onClick={() => { setFilterCategoria(""); setFilterVehiculo(""); }} className="text-xs px-3 py-2 rounded-xl cursor-pointer" style={{ color: "var(--graphite-400)", border: "1px solid var(--graphite-700)" }}>
                    Limpiar filtros
                  </button>
                )}
              </div>

              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                {filtered.length === 0 ? (
                  <p className="px-5 py-10 text-sm text-center" style={{ color: "var(--graphite-500)" }}>
                    Sin movimientos en {monthLabel}. Registra el primero con "Nuevo movimiento".
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead>
                        <tr>
                          {["Fecha", "Movimiento", "Categoria", "Vehiculo / Destino", "Obra", "Litros", "Soporte", ""].map((col) => (
                            <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ backgroundColor: "var(--graphite-800)", color: "var(--graphite-400)" }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((m) => (
                          <tr key={m.id} style={{ borderTop: "1px solid var(--graphite-800)" }}>
                            <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--graphite-300)" }}>{new Date(m.fecha).toLocaleDateString("es-ES")}</td>
                            <td className="px-4 py-2.5">
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{
                                backgroundColor: m.tipo === "entrada" ? "rgba(102, 153, 145, 0.15)" : "rgba(224, 31, 95, 0.15)",
                                color: m.tipo === "entrada" ? "var(--ash-grey-400)" : "var(--raspberry-red-400)",
                              }}>
                                {FUEL_TIPO_LABELS[m.tipo]}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ color: categoriaBadgeColor[m.categoria] }}>
                                {FUEL_CATEGORY_LABELS[m.categoria]}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: "var(--graphite-100)" }}>{destinoOf(m)}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--graphite-400)" }}>{m.obra || "--"}</td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap" style={{ color: "var(--graphite-100)" }}>{m.litros.toLocaleString("es-ES")}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--graphite-400)" }}>{m.soporte || m.nro_factura || "--"}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <button onClick={() => { setEditing(m); setModalOpen(true); }} className="px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: "rgba(0, 81, 255, 0.15)", color: "var(--crayola-blue-400)", border: "1px solid rgba(0, 81, 255, 0.3)" }}>
                                  Editar
                                </button>
                                <button onClick={() => setDeleting(m)} className="px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: "rgba(224, 31, 95, 0.15)", color: "var(--raspberry-red-400)", border: "1px solid rgba(224, 31, 95, 0.3)" }}>
                                  Borrar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {modalOpen && (
          <FuelMovementModal
            movement={editing}
            onClose={() => { setModalOpen(false); setEditing(null); }}
            onSaved={loadData}
          />
        )}

        {deleting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={() => setDeleting(null)}>
            <div className="rounded-2xl border w-full max-w-sm p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }} onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-2" style={{ color: "var(--graphite-100)" }}>Borrar movimiento</h2>
              <p className="text-sm mb-4" style={{ color: "var(--graphite-400)" }}>
                Se borrara el movimiento de {deleting.litros.toLocaleString("es-ES")} L ({FUEL_CATEGORY_LABELS[deleting.categoria]}) del {new Date(deleting.fecha).toLocaleDateString("es-ES")}. El saldo y el cierre se recalculan al instante.
              </p>
              <div className="flex gap-3">
                <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: "var(--raspberry-red-500)", color: "var(--graphite-50)" }}>
                  Borrar
                </button>
                <button onClick={() => setDeleting(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-300)" }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
```

Notas:
- El orden de los helpers de mes (`monthKeyOfFecha`, `monthLabelOfKey`, `getFuelMonthOptions`) vive en `fuelKardexService` (Task 2), no se duplica.
- `VehicleCombobox` dentro del modal carga el catalogo por su cuenta (redux), no necesita la prop `vehicles` de la pagina.

**Step 2: verificar**

Run: `npx tsc --noEmit` then `npm run build`
Expected: exit 0, ruta `○ /combustible` presente.

---

### Task 6: Navbar y ayuda

**Files:**
- Modify: `apps/web/src/components/Navbar.tsx:15-21`
- Modify: `apps/web/src/app/help/page.tsx`

**Step 1: enlace en Navbar**

En el array `links`, despues de "Informe mensual":

```ts
const links = [
  { href: "/", label: "Dashboard" },
  { href: "/records", label: "Registros" },
  { href: "/reports", label: "Informe mensual" },
  { href: "/combustible", label: "Combustible" },
  { href: "/maintenance/new", label: "Nuevo registro" },
  { href: "/help", label: "Ayuda" },
];
```

Nota: son 6 links; verificar tras el cambio que no reaparezca el scroll horizontal (el navbar tiene flex-wrap desde el fix de marca — medir con el replica o revisar que a 1280+ siga en una fila y por debajo haga wrap).

**Step 2: seccion nueva en /help**

En el array `sections`, insertar justo despues de la seccion `informe-mensual`:

```ts
  {
    id: "combustible",
    title: "Combustible (kardex de gasoil)",
    content:
      "El kardex de gasoil registra las entradas (compras) y salidas (egresos) de combustible con saldo automatico. Reemplaza el Excel CONTROL DE GASOIL: el sistema calcula la existencia actual, el consumo por categoria y el cierre del mes.",
    subsections: [
      {
        title: "Flujo",
        steps: [
          "Carga la existencia inicial una sola vez con el boton 'Existencia inicial': usa el saldo del ultimo cierre del Excel.",
          "Registra cada compra con 'Nuevo movimiento' y categoria 'Compra (ingreso)'.",
          "Registra cada egreso con su categoria: Interno (flota/obra con vehiculo del catalogo), Planta (toneladas x T/L), Sindicato (chofer y placa) o Terceros (placa y talonario).",
          "Revisa la existencia actual y el cierre del mes; se recalculan solos con cada movimiento.",
          "Exporta el cierre en Excel (hojas por categoria, igual que el formato original) o en PDF resumen.",
        ],
      },
      {
        title: "Como se calcula",
        items: [
          { name: "Existencia actual", desc: "Existencia inicial + ingresos - egresos de todos los movimientos registrados." },
          { name: "Cierre del mes", desc: "Existencia previa del mes + ingresos del mes - consumo del mes = existencia al cierre. La previa incluye los movimientos anteriores al mes." },
          { name: "Litros (planta)", desc: "En despacho de planta los litros se calculan como toneladas x T/L (factor configurable por movimiento, 1.5 por defecto)." },
          { name: "Litros por dia", desc: "Consumo del mes dividido entre los dias transcurridos del mes." },
        ],
      },
    ],
  },
```

**Step 3: verificar**

Run: `npx tsc --noEmit` then `npm run build`
Expected: exit 0.

---

### Task 7: Verificacion final y prueba manual

**Files:** ninguno (verificacion)

**Step 1: build completo**

Run (workdir `apps/web`): `npx tsc --noEmit; if ($?) { npm run build }`
Expected: exit 0, rutas `○ /combustible` presentes.

**Step 2: prueba manual (dev server)**

1. `/combustible` carga desde el navbar; no hay scroll horizontal nuevo con 6 links
2. 'Existencia inicial' -> cargar 21341 -> guardar
3. Registrar una compra (1000 L, proveedor PDVSA) -> existencia sube
4. Registrar un interno (vehiculo del catalogo, obra PATIO, 122 L) -> egreso en la tabla
5. Registrar planta (373.6 ton x 1.5) -> litros calculados 560.40
6. Registrar sindicato (chofer, CI, placa) y tercero (placa, talonario)
7. El cierre cuadra: previa + ingresos - consumo = existencia; badges correctos
8. Editar un movimiento -> saldo se recalcula; borrar con confirmacion ->同样
9. Filtros de categoria y vehiculo funcionan
10. Exportar Excel -> 6 hojas (Cierre, Interno, Planta, Sindicato, Terceros, Ingresos); Exportar PDF -> cierre + tabla
11. `/help` -> seccion "Combustible (kardex de gasoil)" en el TOC

**Step 3: pedir permiso de commit**

Preguntar al usuario antes de commitear. **NO commitear sin respuesta afirmativa.**

---

## Orden de ejecucion

1 (types) -> 2 (service) -> 3 (modal) -> 4 (exports) -> 5 (pagina, importa el service de exports) -> 6 (navbar/help) -> 7 (verificacion).

Entre tasks: `npx tsc --noEmit` siempre; `npm run build` tras tasks 5, 6 y al final.
