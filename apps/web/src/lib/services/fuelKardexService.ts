import { collection, addDoc, getDocs, query, where, Timestamp, doc, updateDoc, getDoc, setDoc, deleteDoc, deleteField } from "@firebase/firestore";
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
  const payload = buildPayload(data);
  const optional: (keyof FuelMovementInput)[] = [
    "vehicle_id", "obra", "toneladas", "t_l", "chofer", "ci", "placa",
    "talonario", "proveedor", "nro_control", "nro_factura", "soporte", "nota",
  ];
  const update: Record<string, unknown> = { ...payload, updated_at: Timestamp.now() };
  for (const key of optional) {
    if (!(key in payload)) update[key] = deleteField();
  }
  await updateDoc(doc(fuelRef, id), update);
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
  return Array.from(keys).filter((k) => k !== "").sort().reverse();
}
