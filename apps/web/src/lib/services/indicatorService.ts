import type { MaintenanceEvent, EventType } from "@/types/maintenance";

export interface Indicators {
  mtbf: number | null;
  mttr: number | null;
  mttf: number | null;
  availability: number | null;
  totalEvents: number;
  correctiveCount: number;
  preventiveCount: number;
  inspectionCount: number;
}

function hoursBetween(a: string, b: string): number {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (Number.isNaN(t1) || Number.isNaN(t2)) return NaN;
  return (t2 - t1) / 3600000;
}

function isValidDate(iso: string | undefined | null): boolean {
  if (!iso) return false;
  return !Number.isNaN(new Date(iso).getTime());
}

function groupByUnit(events: MaintenanceEvent[]): Map<string, MaintenanceEvent[]> {
  const map = new Map<string, MaintenanceEvent[]>();
  events.forEach((e) => {
    const list = map.get(e.vehicle_id) ?? [];
    list.push(e);
    map.set(e.vehicle_id, list);
  });
  return map;
}

function operatingHoursForUnit(unitEvents: MaintenanceEvent[], endTime: number): number {
  const failures = unitEvents
    .map((e) => new Date(e.failure_timestamp).getTime())
    .filter((t) => !Number.isNaN(t));
  if (failures.length === 0) return 0;
  const firstFailure = Math.min(...failures);
  const observation = Math.max(0, (endTime - firstFailure) / 3600000);
  const downtime = unitEvents.reduce((sum, e) => {
    const h = hoursBetween(e.failure_timestamp, e.workshop_exit_time);
    return sum + (Number.isFinite(h) && h > 0 ? h : 0);
  }, 0);
  return Math.max(0, observation - downtime);
}

// MTBF de flota: suma las horas de operacion de cada unidad y divide entre el total de
// correctivos. Asi el tiempo en taller de una unidad no resta horas de las demas.
function fleetMtbf(corrective: MaintenanceEvent[], endTime: number): number | null {
  if (corrective.length === 0) return null;
  let operating = 0;
  groupByUnit(corrective).forEach((unitEvents) => {
    operating += operatingHoursForUnit(unitEvents, endTime);
  });
  const result = operating / corrective.length;
  return Number.isFinite(result) && result > 0 ? Math.round(result * 10) / 10 : null;
}

export function calculateIndicators(allEvents: MaintenanceEvent[], options: { endTime?: number } = {}): Indicators {
  const events = allEvents.filter((e) => e.status !== "DELETED");
  if (events.length === 0) {
    return { mtbf: null, mttr: null, mttf: null, availability: null, totalEvents: 0, correctiveCount: 0, preventiveCount: 0, inspectionCount: 0 };
  }

  const corrective = events
    .filter((e) => e.event_type === "CORRECTIVE")
    .sort((a, b) => new Date(a.failure_timestamp).getTime() - new Date(b.failure_timestamp).getTime());

  const preventive = events.filter((e) => e.event_type === "PREVENTIVE");
  const inspectionCount = events.filter((e) => e.event_type === "INSPECTION").length;

  const closedCorrective = corrective.filter((e) => isValidDate(e.workshop_exit_time));

  // --- MTTR: promedio de downtime total por evento correctivo ---
  // Downtime = workshop_exit_time - failure_timestamp
  // Solo se miden los correctivos con salida registrada: un evento abierto no tiene duracion.
  const mttr = closedCorrective.length > 0
    ? closedCorrective.reduce((sum, e) => sum + hoursBetween(e.failure_timestamp, e.workshop_exit_time), 0) / closedCorrective.length
    : null;

  // --- MTBF: (Tiempo Total de Operación - Tiempo Total Inactividad) / N Correctivos ---
  // Se calcula por unidad: cada unidad aporta sus horas de operacion desde su primera falla
  // del periodo hasta el cierre del periodo, menos su propio tiempo en taller.
  const endTime = Math.min(options.endTime ?? Date.now(), Date.now());
  const mtbf = fleetMtbf(corrective, endTime);

  // --- MTTF: solo componentes REPLACED (consumibles) ---
  const replaced = events.filter((e) => e.action_taken === "REPLACED");
  const mttf = replaced.length > 0
    ? replaced.reduce((sum, e) => sum + (e.effective_work_hours ?? 0), 0) / replaced.length
    : null;

  // --- Disponibilidad: MTBF / (MTBF + MTTR) * 100 ---
  let availability: number | null = null;
  if (mtbf !== null && mttr !== null && mtbf + mttr > 0) {
    const result = (mtbf / (mtbf + mttr)) * 100;
    availability = isNaN(result) ? null : Math.round(result * 10) / 10;
  }

  return { mtbf, mttr, mttf, availability, totalEvents: events.length, correctiveCount: corrective.length, preventiveCount: preventive.length, inspectionCount };
}

export function formatHours(hours: number | null): string {
  if (hours === null || isNaN(hours)) return "--";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

export function formatPercent(value: number | null): string {
  if (value === null || isNaN(value)) return "--%";
  return `${value.toFixed(1)}%`;
}

export function formatIndicator(value: number | null | undefined, suffix = "", decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return `${value.toFixed(decimals)}${suffix}`;
}

// --- Chart Data Functions ---

export interface PieData { name: string; value: number; fill: string; key: string }

export function getEventTypePieData(events: MaintenanceEvent[]): PieData[] {
  const counts: Record<EventType, number> = { CORRECTIVE: 0, PREVENTIVE: 0, INSPECTION: 0, PREDICTIVE: 0 };
  events.forEach((e) => { counts[e.event_type]++; });
  return [
    { name: "Correctivos", value: counts.CORRECTIVE, fill: "#E01F5F", key: "CORRECTIVE" },
    { name: "Preventivos", value: counts.PREVENTIVE, fill: "#669991", key: "PREVENTIVE" },
    { name: "Inspecciones", value: counts.INSPECTION, fill: "#F7B708", key: "INSPECTION" },
    { name: "Predictivos", value: counts.PREDICTIVE, fill: "#0051FF", key: "PREDICTIVE" },
  ];
}

export interface BarData { month: string; cantidad: number }

export function getMonthlyBarData(events: MaintenanceEvent[]): BarData[] {
  const map = new Map<string, number>();
  events.forEach((e) => {
    const d = new Date(e.failure_timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cantidad]) => ({ month, cantidad }));
}

export interface CostData { category: string; costo: number; key: string }

const CATEGORY_ES: Record<string, string> = {
  ENGINE: "Motor", TRANSMISSION: "Transmision", BRAKES: "Frenos",
  ELECTRICAL: "Electrico", TIRES: "Neumaticos", SUSPENSION: "Suspension", OTHER: "Otro",
};

export function getCostByCategoryData(events: MaintenanceEvent[]): CostData[] {
  const map = new Map<string, number>();
  events.forEach((e) => {
    const label = CATEGORY_ES[e.system_category] ?? e.system_category;
    map.set(label, (map.get(label) ?? 0) + (e.repair_cost ?? 0));
  });
  return Array.from(map.entries())
    .map(([category, costo]) => ({ category, costo, key: category }))
    .sort((a, b) => b.costo - a.costo);
}

export interface TrendPoint { month: string; mtbf: number | null; mttr: number | null }

export function getMTBFMTTRTrend(events: MaintenanceEvent[]): TrendPoint[] {
  const byMonth = new Map<string, MaintenanceEvent[]>();
  events.forEach((e) => {
    const d = new Date(e.failure_timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(e);
  });

  const sorted = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));

  return sorted.map(([month, monthEvents]) => {
    const corrective = monthEvents
      .filter((e) => e.event_type === "CORRECTIVE")
      .sort((a, b) => new Date(a.failure_timestamp).getTime() - new Date(b.failure_timestamp).getTime());

    const closedCorrective = corrective.filter((e) => isValidDate(e.workshop_exit_time));

    const [year, monthNumber] = month.split("-").map(Number);
    const monthEnd = new Date(year, monthNumber, 1).getTime();
    const endTime = Math.min(Number.isNaN(monthEnd) ? Date.now() : monthEnd, Date.now());
    const mtbf = fleetMtbf(corrective, endTime);

    const mttr = closedCorrective.length > 0
      ? closedCorrective.reduce((sum, e) => sum + hoursBetween(e.failure_timestamp, e.workshop_exit_time), 0) / closedCorrective.length
      : null;

    return {
      month,
      mtbf: mtbf != null && mtbf > 0 ? mtbf : null,
      mttr: mttr && !isNaN(mttr) ? Math.round(mttr * 10) / 10 : null,
    };
  });
}

export interface VehicleData { vehicle: string; fallas: number; key: string }

export function getTopVehiclesData(events: MaintenanceEvent[], top = 5): VehicleData[] {
  const map = new Map<string, number>();
  events.forEach((e) => {
    map.set(e.vehicle_id, (map.get(e.vehicle_id) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([vehicle, fallas]) => ({ vehicle, fallas, key: vehicle }))
    .sort((a, b) => b.fallas - a.fallas)
    .slice(0, top);
}
