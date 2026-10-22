import type { MaintenanceEvent } from "@/types/maintenance";
import { calculateIndicators, type Indicators } from "./indicatorService";
import type { Vehicle } from "@/types/vehicle";

export type ReportStatusFilter = "OPEN" | "CLOSED" | "BLOCKED";

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  vehicleIds: string[];
  eventTypes: string[];
  statuses: ReportStatusFilter[];
  systems: string[];
  components: string[];
  rootCauses: string[];
  fleetGroups: string[];
}

export const EMPTY_FILTERS: ReportFilters = {
  dateFrom: "",
  dateTo: "",
  vehicleIds: [],
  eventTypes: [],
  statuses: [],
  systems: [],
  components: [],
  rootCauses: [],
  fleetGroups: [],
};

export interface ReportBreakdown {
  label: string;
  count: number;
  cost: number;
}

export interface ReportSummary {
  total: number;
  corrective: number;
  preventive: number;
  inspection: number;
  predictive: number;
  open: number;
  closed: number;
  blocked: number;
  costTotal: number;
  hoursTotal: number;
  indicators: Indicators;
  bySystem: ReportBreakdown[];
  byVehicle: ReportBreakdown[];
  byFleetGroup: ReportBreakdown[];
  byComponent: ReportBreakdown[];
  byRootCause: ReportBreakdown[];
}

function startOfDay(value: string): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const t = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

function endOfDay(value: string): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const t = new Date(`${value}T23:59:59.999`).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function isBlocked(event: MaintenanceEvent): boolean {
  return !!event.block_reason?.trim();
}

function isOpen(event: MaintenanceEvent): boolean {
  return !event.status || event.status === "PENDING";
}

export function matchesStatus(event: MaintenanceEvent, statuses: ReportStatusFilter[]): boolean {
  if (statuses.length === 0) return true;
  return statuses.some((s) => {
    if (s === "OPEN") return isOpen(event);
    if (s === "CLOSED") return event.status === "COMPLETED";
    return isBlocked(event);
  });
}

export function applyReportFilters(
  events: MaintenanceEvent[],
  filters: ReportFilters,
  vehicles: Vehicle[]
): MaintenanceEvent[] {
  const vehicleMap = new Map(vehicles.map((v) => [v.vehicle_id, v]));
  const from = startOfDay(filters.dateFrom);
  const to = endOfDay(filters.dateTo);

  return events.filter((e) => {
    const t = new Date(e.failure_timestamp).getTime();
    if (!Number.isNaN(t) && (t < from || t > to)) return false;
    if (filters.vehicleIds.length > 0 && filters.vehicleIds.length < vehicles.length && !filters.vehicleIds.includes(e.vehicle_id)) return false;
    if (filters.eventTypes.length > 0 && !filters.eventTypes.includes(e.event_type)) return false;
    if (!matchesStatus(e, filters.statuses)) return false;
    if (filters.systems.length > 0 && !filters.systems.includes(e.system_category as string)) return false;
    if (filters.components.length > 0 && !filters.components.includes(e.component_id)) return false;
    if (filters.rootCauses.length > 0 && !filters.rootCauses.includes(e.root_cause ?? "")) return false;
    if (filters.fleetGroups.length > 0) {
      const group = vehicleMap.get(e.vehicle_id)?.fleet_group?.trim() || "Sin grupo";
      if (!filters.fleetGroups.includes(group)) return false;
    }
    return true;
  });
}

function breakdown(
  events: MaintenanceEvent[],
  labelOf: (e: MaintenanceEvent) => string
): ReportBreakdown[] {
  const map = new Map<string, { count: number; cost: number }>();
  events.forEach((e) => {
    const label = labelOf(e);
    const current = map.get(label) ?? { count: 0, cost: 0 };
    current.count += 1;
    current.cost += e.repair_cost || 0;
    map.set(label, current);
  });
  return Array.from(map.entries())
    .map(([label, v]) => ({ label, count: v.count, cost: v.cost }))
    .sort((a, b) => b.count - a.count || b.cost - a.cost);
}

export function buildReportSummary(events: MaintenanceEvent[], vehicles: Vehicle[]): ReportSummary {
  const vehicleMap = new Map(vehicles.map((v) => [v.vehicle_id, v]));
  return {
    total: events.length,
    corrective: events.filter((e) => e.event_type === "CORRECTIVE").length,
    preventive: events.filter((e) => e.event_type === "PREVENTIVE").length,
    inspection: events.filter((e) => e.event_type === "INSPECTION").length,
    predictive: events.filter((e) => e.event_type === "PREDICTIVE").length,
    open: events.filter(isOpen).length,
    closed: events.filter((e) => e.status === "COMPLETED").length,
    blocked: events.filter(isBlocked).length,
    costTotal: events.reduce((sum, e) => sum + (e.repair_cost || 0), 0),
    hoursTotal: events.reduce((sum, e) => sum + (e.effective_work_hours ?? 0), 0),
    indicators: calculateIndicators(events),
    bySystem: breakdown(events, (e) => (e.system_category as string) || "Sin sistema"),
    byVehicle: breakdown(events, (e) => e.vehicle_id),
    byFleetGroup: breakdown(events, (e) => vehicleMap.get(e.vehicle_id)?.fleet_group?.trim() || "Sin grupo"),
    byComponent: breakdown(events, (e) => e.component_id || "Sin componente"),
    byRootCause: breakdown(events, (e) => e.root_cause || "Sin causa"),
  };
}

export interface DatePreset {
  key: string;
  label: string;
  from: string;
  to: string;
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getDatePresets(): DatePreset[] {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const threeMonthsStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  return [
    { key: "current", label: "Mes actual", from: isoDay(monthStart), to: isoDay(now) },
    { key: "previous", label: "Mes anterior", from: isoDay(prevMonthStart), to: isoDay(prevMonthEnd) },
    { key: "quarter", label: "Ultimos 3 meses", from: isoDay(threeMonthsStart), to: isoDay(now) },
    { key: "year", label: "Este ano", from: isoDay(yearStart), to: isoDay(now) },
    { key: "all", label: "Todo", from: "", to: "" },
  ];
}

export function formatRangeLabel(filters: ReportFilters): string {
  if (!filters.dateFrom && !filters.dateTo) return "Todo el historico";
  const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).toLocaleDateString("es-ES") : "inicio";
  const to = filters.dateTo ? new Date(`${filters.dateTo}T00:00:00`).toLocaleDateString("es-ES") : "hoy";
  return `${from} a ${to}`;
}
