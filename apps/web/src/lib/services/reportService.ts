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
  if (Number.isNaN(start) || Number.isNaN(end)) return null;

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
  if (report.total === 0) {
    return `No se registraron intervenciones de mantenimiento en ${report.monthLabel}.`;
  }
  const topSystems = report.bySystem.slice(0, 3).map((s) => `${s.label} (${s.count})`).join(", ");
  const partes = [
    `Durante ${report.monthLabel} se registraron ${report.total} intervenciones de mantenimiento: ${report.preventivePct}% preventivas (${report.preventive.length}) y ${report.correctivePct}% correctivas (${report.corrective.length}).`,
    report.closureEfficiency != null
      ? `La eficiencia de cierre fue de ${report.closureEfficiency}%, con ${report.closedInMonth} evento(s) cerrados en el mes.`
      : "La eficiencia de cierre no se pudo calcular (sin datos).",
    `El backlog actual es de ${report.backlog.length} evento(s) abierto(s) o bloqueado(s).`,
    `El costo total de reparaciones del mes alcanzo $${report.costTotal.toLocaleString("es-ES")}.`,
  ];
  if (topSystems) partes.push(`Los sistemas con mayor incidencia fueron: ${topSystems}.`);
  return partes.join(" ");
}
