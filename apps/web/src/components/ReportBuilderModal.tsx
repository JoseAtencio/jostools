"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import MultiSelectFilter, { type MultiSelectOption } from "@/components/MultiSelectFilter";
import EventTypePieChart from "@/components/charts/EventTypePieChart";
import MonthlyEventsChart from "@/components/charts/MonthlyEventsChart";
import TrendChart from "@/components/charts/TrendChart";
import CostByCategoryChart from "@/components/charts/CostByCategoryChart";
import TopVehiclesChart from "@/components/charts/TopVehiclesChart";
import { useAppSelector } from "@/lib/redux/hooks";
import { getCategoriesByGroup } from "@/lib/services/categoryService";
import { getVehicles } from "@/lib/services/vehicleService";
import { getCostByCategoryData,
  getEventTypePieData,
  getMonthlyBarData,
  getMTBFMTTRTrend,
  getTopVehiclesData,
} from "@/lib/services/indicatorService";
import {
  applyReportFilters,
  buildReportSummary,
  formatRangeLabel,
  getDatePresets,
  EMPTY_FILTERS,
  type ReportFilters,
  type ReportStatusFilter,
} from "@/lib/services/detailedReportService";
import { CHART_DESCRIPTIONS } from "@/lib/chartDescriptions";
import { exportDetailedReport } from "@/lib/services/detailedReportExportService";
import { formatIndicator } from "@/lib/services/indicatorService";
import { type MaintenanceEvent } from "@/types/maintenance";
import type { Vehicle } from "@/types/vehicle";
import type { Category } from "@/types/categories";

interface Props {
  open: boolean;
  onClose: () => void;
  events: MaintenanceEvent[];
}

const EVENT_TYPE_OPTIONS: MultiSelectOption[] = [
  { value: "CORRECTIVE", label: "Correctivo" },
  { value: "PREVENTIVE", label: "Preventivo" },
  { value: "INSPECTION", label: "Inspeccion" },
  { value: "PREDICTIVE", label: "Predictivo" },
];

const STATUS_OPTIONS: MultiSelectOption[] = [
  { value: "OPEN", label: "Abierto" },
  { value: "CLOSED", label: "Cerrado" },
  { value: "BLOCKED", label: "Bloqueado" },
];

const LIGHT_PIE_COLORS: Record<string, string> = {
  CORRECTIVE: "#E01F5F",
  PREVENTIVE: "#0F766E",
  INSPECTION: "#B45309",
  PREDICTIVE: "#1D4ED8",
};

function kpi(label: string, value: string, accent: string, hint?: string) {
  return (
    <div
      className="rounded-xl border px-3 py-2.5 flex items-center gap-2.5"
      style={{ backgroundColor: "var(--graphite-950)", borderColor: "var(--graphite-800)" }}
    >
      <span className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--graphite-500)" }}>{label}</p>
        <p className="text-sm font-bold leading-tight" style={{ color: "var(--graphite-50)" }}>{value}</p>
        {hint && <p className="text-[10px] leading-tight" style={{ color: "var(--graphite-500)" }}>{hint}</p>}
      </div>
    </div>
  );
}

function FilterCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--graphite-950)", border: "1px solid var(--graphite-800)" }}>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <span className="text-xs font-bold" style={{ color: "var(--graphite-100)" }}>{title}</span>
        {hint && <span className="text-[10px] text-right" style={{ color: "var(--graphite-500)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function mergeOptions(categories: Category[], usedValues: string[]): MultiSelectOption[] {
  const options: MultiSelectOption[] = categories.map((c) => ({ value: c.name, label: c.label }));
  const known = new Set(options.map((o) => o.value));
  usedValues.forEach((v) => {
    if (v && !known.has(v)) {
      options.push({ value: v, label: v });
      known.add(v);
    }
  });
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export default function ReportBuilderModal({ open, onClose, events }: Props) {
  const { user } = useAppSelector((state) => state.auth);
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [systems, setSystems] = useState<Category[]>([]);
  const [components, setComponents] = useState<Category[]>([]);
  const [rootCauses, setRootCauses] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [generating, setGenerating] = useState(false);
  const chartsRef = useRef<HTMLDivElement>(null);
  const topVehiclesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    const enterpriseId = user?.enterpriseId;
    if (!enterpriseId) {
      setLoadingData(false);
      return;
    }
    Promise.all([
      getVehicles(enterpriseId),
      getCategoriesByGroup("system_category"),
      getCategoriesByGroup("component"),
      getCategoriesByGroup("root_cause"),
    ])
      .then(([vehs, sys, comp, cause]) => {
        setVehicles(vehs);
        setSystems(sys);
        setComponents(comp);
        setRootCauses(cause);
      })
      .catch(() => undefined)
      .finally(() => setLoadingData(false));
  }, [open, user?.enterpriseId]);

  const filtered = useMemo(() => applyReportFilters(events, filters, vehicles), [events, filters, vehicles]);
  const summary = useMemo(() => buildReportSummary(filtered, vehicles), [filtered, vehicles]);

  const vehicleOptions = useMemo<MultiSelectOption[]>(
    () =>
      vehicles.map((v) => ({
        value: v.vehicle_id,
        label: v.vehicle_id,
        hint: [v.vehicle_code, v.brand, v.model, v.fleet_group].filter(Boolean).join(" · "),
      })),
    [vehicles]
  );

  const systemOptions = useMemo(
    () => mergeOptions(systems, events.map((e) => e.system_category as string)),
    [systems, events]
  );
  const componentOptions = useMemo(
    () => mergeOptions(components, events.map((e) => e.component_id)),
    [components, events]
  );
  const rootCauseOptions = useMemo(
    () => mergeOptions(rootCauses, events.map((e) => e.root_cause ?? "")),
    [rootCauses, events]
  );

  const fleetOptions = useMemo<MultiSelectOption[]>(() => {
    const set = new Set<string>();
    vehicles.forEach((v) => set.add(v.fleet_group?.trim() || "Sin grupo"));
    return Array.from(set)
      .sort()
      .map((g) => ({ value: g, label: g }));
  }, [vehicles]);

  const pieData = useMemo(() => getEventTypePieData(filtered), [filtered]);
  const lightPieData = useMemo(
    () =>
      pieData.map((d) => ({
        ...d,
        fill: LIGHT_PIE_COLORS[d.key] ?? d.fill,
      })),
    [pieData]
  );
  const monthData = useMemo(() => getMonthlyBarData(filtered), [filtered]);
  const trendData = useMemo(() => getMTBFMTTRTrend(filtered), [filtered]);
  const costData = useMemo(() => getCostByCategoryData(filtered), [filtered]);
  const vehicleData = useMemo(() => getTopVehiclesData(filtered, 8), [filtered]);

  const setFilter = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const pct = (n: number) => (summary.total > 0 ? Math.round((n / summary.total) * 1000) / 10 : 0);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await exportDetailedReport({
        events: filtered,
        summary,
        rangeLabel: formatRangeLabel(filters),
        chartsElement: chartsRef.current,
        topVehiclesElement: topVehiclesRef.current,
      });
    } catch {
      alert("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[92vh] rounded-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--graphite-800)" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--graphite-50)" }}>Generar reporte</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--graphite-500)" }}>
              Configura los filtros y revisa la vista previa antes de descargar el PDF
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: "var(--graphite-800)", color: "var(--graphite-300)" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[380px_1fr] overflow-hidden">
          <div className="overflow-y-auto p-4 space-y-3" style={{ borderRight: "1px solid var(--graphite-800)" }}>
            <FilterCard title="Periodo" hint="Por fecha de falla">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilter("dateFrom", e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
                  style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}
                />
                <span className="text-xs" style={{ color: "var(--graphite-500)" }}>a</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilter("dateTo", e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
                  style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {getDatePresets().map((p) => {
                  const active = filters.dateFrom === p.from && filters.dateTo === p.to;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setFilters((prev) => ({ ...prev, dateFrom: p.from, dateTo: p.to }))}
                      className="text-xs px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                      style={{
                        backgroundColor: active ? "rgba(247, 183, 8, 0.15)" : "var(--graphite-900)",
                        color: active ? "var(--tuscan-sun-400)" : "var(--graphite-300)",
                        border: `1px solid ${active ? "var(--tuscan-sun-500)" : "var(--graphite-700)"}`,
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </FilterCard>

            <FilterCard title="Vehiculos" hint="Placa, codigo, marca o modelo">
              <MultiSelectFilter
                label=""
                options={vehicleOptions}
                selected={filters.vehicleIds}
                onChange={(v) => setFilter("vehicleIds", v)}
                searchable
                searchPlaceholder="Buscar vehiculo..."
                maxHeight={150}
                emptyText="No hay vehiculos en el catalogo"
              />
            </FilterCard>

            <FilterCard title="Tipo de evento y estado">
              <div className="space-y-3">
                <MultiSelectFilter
                  label="Tipo de evento"
                  options={EVENT_TYPE_OPTIONS}
                  selected={filters.eventTypes}
                  onChange={(v) => setFilter("eventTypes", v)}
                />
                <MultiSelectFilter
                  label="Estado"
                  options={STATUS_OPTIONS}
                  selected={filters.statuses as string[]}
                  onChange={(v) => setFilter("statuses", v as ReportStatusFilter[])}
                />
              </div>
            </FilterCard>

            <FilterCard title="Que se fallo" hint="Sistema, componente y causa">
              <div className="space-y-3">
                <MultiSelectFilter
                  label="Sistema afectado"
                  options={systemOptions}
                  selected={filters.systems}
                  onChange={(v) => setFilter("systems", v)}
                  searchable
                  searchPlaceholder="Buscar sistema"
                  maxHeight={120}
                />
                <MultiSelectFilter
                  label="Componente"
                  options={componentOptions}
                  selected={filters.components}
                  onChange={(v) => setFilter("components", v)}
                  searchable
                  searchPlaceholder="Buscar componente"
                  maxHeight={120}
                />
                <MultiSelectFilter
                  label="Causa raiz"
                  options={rootCauseOptions}
                  selected={filters.rootCauses}
                  onChange={(v) => setFilter("rootCauses", v)}
                  searchable
                  searchPlaceholder="Buscar causa"
                  maxHeight={120}
                />
              </div>
            </FilterCard>

            <FilterCard title="Grupo de flota">
              <MultiSelectFilter
                label=""
                options={fleetOptions}
                selected={filters.fleetGroups}
                onChange={(v) => setFilter("fleetGroups", v)}
                maxHeight={110}
              />
            </FilterCard>
          </div>

          <div className="overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm font-semibold" style={{ color: "var(--graphite-200)" }}>Vista previa</span>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--graphite-500)" }}>
                  {formatRangeLabel(filters)} · {filtered.length} de {events.length} eventos coinciden con los filtros
                </p>
              </div>
              {loadingData && <span className="text-xs" style={{ color: "var(--graphite-500)" }}>Cargando datos...</span>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              {kpi("Eventos", String(summary.total), "var(--graphite-500)")}
              {kpi("Correctivos", String(summary.corrective), "var(--raspberry-red-400)", `${pct(summary.corrective)}% del total`)}
              {kpi("Preventivos", String(summary.preventive), "var(--ash-grey-400)", `${pct(summary.preventive)}% del total`)}
              {kpi("Cerrados", String(summary.closed), "var(--crayola-blue-400)", `${pct(summary.closed)}% del total`)}
              {kpi("MTBF", formatIndicator(summary.indicators.mtbf, " h"), "var(--tuscan-sun-400)", "Horas entre fallas")}
              {kpi("MTTR", formatIndicator(summary.indicators.mttr, " h"), "var(--raspberry-red-400)", "Horas de reparacion")}
              {kpi("Disponibilidad", formatIndicator(summary.indicators.availability, "%"), "var(--ash-grey-400)", "Tiempo operativo")}
              {kpi("Costo total", `$${summary.costTotal.toLocaleString("es-ES")}`, "var(--crayola-blue-400)", `${summary.hoursTotal.toFixed(0)} h de taller`)}
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border p-10 text-center" style={{ backgroundColor: "var(--graphite-950)", borderColor: "var(--graphite-800)" }}>
                <p className="text-sm" style={{ color: "var(--graphite-500)" }}>Sin datos para los filtros seleccionados</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <div><EventTypePieChart data={pieData} subtitle={CHART_DESCRIPTIONS.eventType} static /></div>
                <div><MonthlyEventsChart data={monthData} subtitle={CHART_DESCRIPTIONS.monthly} static /></div>
                <div><TrendChart data={trendData} subtitle={CHART_DESCRIPTIONS.trend} static /></div>
                <div><CostByCategoryChart data={costData} subtitle={CHART_DESCRIPTIONS.cost} static /></div>
                <div className="xl:col-span-2"><TopVehiclesChart data={vehicleData} subtitle={CHART_DESCRIPTIONS.topVehicles} static /></div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: "1px solid var(--graphite-800)" }}>
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors"
            style={{ backgroundColor: "var(--graphite-800)", color: "var(--graphite-300)", border: "1px solid var(--graphite-700)" }}
          >
            Limpiar filtros
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors"
              style={{ backgroundColor: "var(--graphite-800)", color: "var(--graphite-300)", border: "1px solid var(--graphite-700)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || filtered.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Generando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Descargar PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="absolute left-[-99999px] top-0" style={{ width: 960 }}>
          <div ref={chartsRef} style={{ width: 960, backgroundColor: "#ffffff", padding: 18 }}>
            <div className="grid grid-cols-2 gap-4">
              <EventTypePieChart data={lightPieData} theme="light" subtitle={CHART_DESCRIPTIONS.eventType} static />
              <MonthlyEventsChart data={monthData} theme="light" subtitle={CHART_DESCRIPTIONS.monthly} static />
              <TrendChart data={trendData} theme="light" subtitle={CHART_DESCRIPTIONS.trend} static />
              <CostByCategoryChart data={costData} theme="light" subtitle={CHART_DESCRIPTIONS.cost} static />
            </div>
          </div>
          <div ref={topVehiclesRef} style={{ width: 960, backgroundColor: "#ffffff", padding: 18, marginTop: 12 }}>
            <TopVehiclesChart data={vehicleData} theme="light" title="Top 8 vehiculos con mas fallas" subtitle={CHART_DESCRIPTIONS.topVehicles} static />
          </div>
        </div>
      )}
    </div>
  );
}
