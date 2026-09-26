import type { MaintenanceEvent } from "@/types/maintenance";

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
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
}

export function calculateIndicators(events: MaintenanceEvent[]): Indicators {
  if (events.length === 0) {
    return { mtbf: null, mttr: null, mttf: null, availability: null, totalEvents: 0, correctiveCount: 0, preventiveCount: 0, inspectionCount: 0 };
  }

  const corrective = events
    .filter((e) => e.event_type === "CORRECTIVE")
    .sort((a, b) => new Date(a.failure_timestamp).getTime() - new Date(b.failure_timestamp).getTime());

  const preventive = events.filter((e) => e.event_type === "PREVENTIVE");
  const inspectionCount = events.filter((e) => e.event_type === "INSPECTION").length;

  // --- MTTR: promedio de downtime total por evento correctivo ---
  // Downtime = workshop_exit_time - failure_timestamp
  const mttr = corrective.length > 0
    ? corrective.reduce((sum, e) => sum + hoursBetween(e.failure_timestamp, e.workshop_exit_time), 0) / corrective.length
    : null;

  // --- MTBF: (Tiempo Total de Operación - Tiempo Total Inactividad) / N Correctivos ---
  let mtbf: number | null = null;
  if (corrective.length >= 1) {
    const allEvents = [...events].sort((a, b) => new Date(a.failure_timestamp).getTime() - new Date(b.failure_timestamp).getTime());
    const primeraFalla = new Date(allEvents[0].failure_timestamp).getTime();
    const ahora = Date.now();
    const totalObservacion = (ahora - primeraFalla) / 3600000;
    const totalInactividad = corrective.reduce((sum, e) => sum + hoursBetween(e.failure_timestamp, e.workshop_exit_time), 0);
    const result = (totalObservacion - totalInactividad) / corrective.length;
    mtbf = result !== null && !isNaN(result) && result > 0 ? Math.round(result * 10) / 10 : null;
  }

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

// --- Chart Data Functions ---

export interface PieData { name: string; value: number; fill: string; key: string }

export function getEventTypePieData(events: MaintenanceEvent[]): PieData[] {
  const counts = { CORRECTIVE: 0, PREVENTIVE: 0, INSPECTION: 0 };
  events.forEach((e) => { counts[e.event_type]++; });
  return [
    { name: "Correctivos", value: counts.CORRECTIVE, fill: "#E01F5F", key: "CORRECTIVE" },
    { name: "Preventivos", value: counts.PREVENTIVE, fill: "#669991", key: "PREVENTIVE" },
    { name: "Inspecciones", value: counts.INSPECTION, fill: "#F7B708", key: "INSPECTION" },
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
    map.set(label, (map.get(label) ?? 0) + e.repair_cost);
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

  let prevCorrectiveTimestamp: number | null = null;
  return sorted.map(([month, monthEvents]) => {
    const corrective = monthEvents
      .filter((e) => e.event_type === "CORRECTIVE")
      .sort((a, b) => new Date(a.failure_timestamp).getTime() - new Date(b.failure_timestamp).getTime());

    let mtbf: number | null = null;
    if (corrective.length >= 2) {
      const totalH = hoursBetween(corrective[0].failure_timestamp, corrective[corrective.length - 1].failure_timestamp);
      const downtime = corrective.reduce((sum, e) => sum + hoursBetween(e.failure_timestamp, e.workshop_exit_time), 0);
      mtbf = (totalH - downtime) / corrective.length;
    } else if (corrective.length === 1 && prevCorrectiveTimestamp !== null) {
      mtbf = (new Date(corrective[0].failure_timestamp).getTime() - prevCorrectiveTimestamp) / 3600000;
    }
    if (corrective.length >= 1) {
      prevCorrectiveTimestamp = new Date(corrective[corrective.length - 1].failure_timestamp).getTime();
    }

    const mttr = corrective.length > 0
      ? corrective.reduce((sum, e) => sum + hoursBetween(e.failure_timestamp, e.workshop_exit_time), 0) / corrective.length
      : null;

    return {
      month,
      mtbf: mtbf && !isNaN(mtbf) && mtbf > 0 ? Math.round(mtbf * 10) / 10 : null,
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
