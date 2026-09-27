"use client";

import { useAppSelector } from "@/lib/redux/hooks";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { seedTestEvents, getMaintenanceEvents, exportEventsToExcel } from "@/lib/services/maintenanceService";
import {
  calculateIndicators, formatHours, formatPercent,
  getEventTypePieData, getMonthlyBarData, getCostByCategoryData,
  getMTBFMTTRTrend, getTopVehiclesData,
  type Indicators, type PieData, type BarData, type CostData, type TrendPoint, type VehicleData,
} from "@/lib/services/indicatorService";
import EventTypePieChart from "@/components/charts/EventTypePieChart";
import MonthlyEventsChart from "@/components/charts/MonthlyEventsChart";
import TrendChart from "@/components/charts/TrendChart";
import CostByCategoryChart from "@/components/charts/CostByCategoryChart";
import TopVehiclesChart from "@/components/charts/TopVehiclesChart";
import CloseEventModal from "@/components/CloseEventModal";
import HelpTip from "@/components/HelpTip";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import type { MaintenanceEvent, EventType, SystemCategory } from "@/types/maintenance";

interface Filters {
  eventType: EventType | null;
  month: string | null;
  category: SystemCategory | null;
  vehicle: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

const CATEGORY_ES_TO_KEY: Record<string, SystemCategory> = {
  Motor: "ENGINE", Transmision: "TRANSMISSION", Frenos: "BRAKES",
  Electrico: "ELECTRICAL", Neumaticos: "TIRES", Suspension: "SUSPENSION", Otro: "OTHER",
};

function getDefaultDateFrom(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function getDefaultDateTo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getThisWeek(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  return { from: toStr(monday), to: toStr(now) };
}

type QuickFilter = "month" | "week" | "day" | "all" | null;

function getActiveQuickFilter(from: string | null, to: string | null): QuickFilter {
  const today = getDefaultDateTo();
  if (from === null && to === null) return "all";
  if (from === today && to === today) return "day";
  const week = getThisWeek();
  if (from === week.from && to === week.to) return "week";
  if (from === getDefaultDateFrom() && to === getDefaultDateTo()) return "month";
  return null;
}

export default function Home() {
  const { user } = useAppSelector((state) => state.auth);
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [closeEvent, setCloseEvent] = useState<MaintenanceEvent | null>(null);

  const [allEvents, setAllEvents] = useState<MaintenanceEvent[]>([]);
  const [filters, setFilters] = useState<Filters>({ eventType: null, month: null, category: null, vehicle: null, dateFrom: getDefaultDateFrom(), dateTo: getDefaultDateTo() });

  const filteredEvents = useMemo(() => {
    let result = allEvents;
    if (filters.eventType) result = result.filter((e) => e.event_type === filters.eventType);
    if (filters.month) result = result.filter((e) => {
      const d = new Date(e.failure_timestamp);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === filters.month;
    });
    if (filters.category) result = result.filter((e) => e.system_category === filters.category);
    if (filters.vehicle) result = result.filter((e) => e.vehicle_id === filters.vehicle);
    if (filters.dateFrom) result = result.filter((e) => new Date(e.failure_timestamp) >= new Date(filters.dateFrom!));
    if (filters.dateTo) {
      const to = new Date(filters.dateTo!);
      to.setHours(23, 59, 59, 999);
      result = result.filter((e) => new Date(e.failure_timestamp) <= to);
    }
    return result;
  }, [allEvents, filters]);

  const openEvents = useMemo(() => allEvents.filter((e) => e.status === "PENDING"), [allEvents]);
  const completedEvents = useMemo(() => filteredEvents.filter((e) => e.status === "COMPLETED"), [filteredEvents]);

  const indicators = useMemo(() => calculateIndicators(completedEvents), [completedEvents]);
  const pieData = useMemo(() => getEventTypePieData(filteredEvents), [filteredEvents]);
  const barData = useMemo(() => getMonthlyBarData(filteredEvents), [filteredEvents]);
  const costData = useMemo(() => getCostByCategoryData(filteredEvents), [filteredEvents]);
  const trendData = useMemo(() => getMTBFMTTRTrend(filteredEvents), [filteredEvents]);
  const vehicleData = useMemo(() => getTopVehiclesData(filteredEvents), [filteredEvents]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.eventType) count++;
    if (filters.month) count++;
    if (filters.category) count++;
    if (filters.vehicle) count++;
    if (filters.dateFrom && filters.dateFrom !== getDefaultDateFrom()) count++;
    if (filters.dateTo && filters.dateTo !== getDefaultDateTo()) count++;
    return count;
  }, [filters]);

  const loadData = useCallback(async () => {
    if (!user?.enterpriseId) return;
    setLoadingData(true);
    try {
      const events = await getMaintenanceEvents(user.enterpriseId);
      setAllEvents(events);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoadingData(false);
    }
  }, [user?.enterpriseId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSeed = async () => {
    if (!user?.uid) return;
    setSeeding(true);
    try {
      await seedTestEvents(user.uid, user.enterpriseId!, 10);
      await loadData();
    } catch (err) {
      console.error("Error seeding:", err);
    } finally {
      setSeeding(false);
    }
  };

  const handleExport = () => {
    if (!indicators || filteredEvents.length === 0) return;
    exportEventsToExcel(filteredEvents, indicators);
  };

  const clearFilters = () => setFilters({ eventType: null, month: null, category: null, vehicle: null, dateFrom: getDefaultDateFrom(), dateTo: getDefaultDateTo() });

  const toggleFilter = (key: keyof Filters, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
  };

  return (
    <AuthGuard>
      <main className="min-h-screen" style={{ backgroundColor: "var(--graphite-950)" }}>
        <Navbar />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: "var(--graphite-50)" }}>
                Dashboard
                <HelpTip title="Resumen general de la flota" text="Indicadores de confiabilidad (MTBF, MTTR, MTTF, Disponibilidad), eventos por tipo, costos y tendencias. Todo se recalcula segun los filtros de fecha y al hacer click en las graficas." />
              </h1>
              <p className="mt-1" style={{ color: "var(--graphite-400)" }}>Panel de control de mantenimiento de flotas</p>
            </div>
            <button onClick={() => router.push("/maintenance/new")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm cursor-pointer transition-all" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Abrir Evento
            </button>
          </div>

          {/* Eventos Abiertos */}
          {openEvents.length > 0 && (
            <div className="mb-8 rounded-2xl border p-5" style={{ backgroundColor: "var(--graphite-900)", borderColor: "rgba(247, 183, 8, 0.3)" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: "var(--tuscan-sun-500)" }} />
                  <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--tuscan-sun-400)" }}>
                    Eventos Abiertos ({openEvents.length})
                    <HelpTip title="Eventos abiertos" text="Eventos que siguen activos en el taller: todavia no se registro la salida. Haz click en una tarjeta para cerrarlo y registrar la fecha de salida, las horas efectivas y el costo final." />
                  </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {openEvents.map((event) => {
                  const failDate = new Date(event.failure_timestamp);
                  const entryDate = new Date(event.workshop_entry_time);
                  const hoursOpen = ((Date.now() - entryDate.getTime()) / 3600000).toFixed(1);
                  return (
                    <button key={event.id} onClick={() => setCloseEvent(event)} className="text-left p-4 rounded-xl border transition-all cursor-pointer" style={{ backgroundColor: "var(--graphite-800)", borderColor: "var(--graphite-700)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--tuscan-sun-500)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--graphite-700)"; }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold" style={{ color: "var(--graphite-100)" }}>{event.vehicle_id}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ backgroundColor: "rgba(247, 183, 8, 0.15)", color: "var(--tuscan-sun-400)" }}>Abierto</span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--graphite-400)" }}>{failDate.toLocaleDateString("es-ES")} - {failDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--graphite-500)" }}>Entrada: {hoursOpen}h en taller</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filtro por fecha */}
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium" style={{ color: "var(--graphite-400)" }}>
              Filtrar por fecha:
              <HelpTip title="Filtro de fechas" text="Define el rango de fechas del periodo analizado. Los botones rapidos (Este mes, Esta semana, Este dia, Todos los dias) ajustan el rango automaticamente. Solo se cuentan los eventos cuya fecha de falla esta dentro del rango." />
            </span>
            <div className="flex items-center gap-1">
              <label htmlFor="dateFrom" className="cursor-pointer p-1.5 rounded-md transition-colors" style={{ color: "var(--graphite-400)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--tuscan-sun-400)"; e.currentTarget.style.backgroundColor = "rgba(247, 183, 8, 0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--graphite-400)"; e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </label>
              <input
                id="dateFrom"
                type="date"
                value={filters.dateFrom ?? ""}
                max={filters.dateTo ?? undefined}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value || null }))}
                className="px-3 py-1.5 rounded-lg text-xs outline-none transition-all"
                style={{
                  backgroundColor: "var(--graphite-800)",
                  border: `1px solid ${filters.dateFrom ? "var(--tuscan-sun-500)" : "var(--graphite-700)"}`,
                  color: "var(--graphite-200)",
                }}
              />
            </div>
            <span className="text-xs" style={{ color: "var(--graphite-500)" }}>hasta</span>
            <div className="flex items-center gap-1">
              <label htmlFor="dateTo" className="cursor-pointer p-1.5 rounded-md transition-colors" style={{ color: "var(--graphite-400)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--tuscan-sun-400)"; e.currentTarget.style.backgroundColor = "rgba(247, 183, 8, 0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--graphite-400)"; e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </label>
              <input
                id="dateTo"
                type="date"
                value={filters.dateTo ?? ""}
                min={filters.dateFrom ?? undefined}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value || null }))}
                className="px-3 py-1.5 rounded-lg text-xs outline-none transition-all"
                style={{
                  backgroundColor: "var(--graphite-800)",
                  border: `1px solid ${filters.dateTo ? "var(--tuscan-sun-500)" : "var(--graphite-700)"}`,
                  color: "var(--graphite-200)",
                }}
              />
            </div>
            {([
              { key: "month" as QuickFilter, label: "Este mes", onClick: () => setFilters((prev) => ({ ...prev, dateFrom: getDefaultDateFrom(), dateTo: getDefaultDateTo() })) },
              { key: "week" as QuickFilter, label: "Esta semana", onClick: () => { const w = getThisWeek(); setFilters((prev) => ({ ...prev, dateFrom: w.from, dateTo: w.to })); } },
              { key: "day" as QuickFilter, label: "Este dia", onClick: () => setFilters((prev) => ({ ...prev, dateFrom: getDefaultDateTo(), dateTo: getDefaultDateTo() })) },
              { key: "all" as QuickFilter, label: "Todos los dias", onClick: () => setFilters((prev) => ({ ...prev, dateFrom: null, dateTo: null })) },
            ]).map((btn) => {
              const active = getActiveQuickFilter(filters.dateFrom, filters.dateTo) === btn.key;
              return (
                <button key={btn.key} onClick={btn.onClick} className="text-xs px-2.5 py-1 rounded-lg cursor-pointer transition-all font-medium" style={{
                  color: active ? "var(--graphite-950)" : "var(--graphite-400)",
                  backgroundColor: active ? "var(--tuscan-sun-500)" : "var(--graphite-800)",
                  border: `1px solid ${active ? "var(--tuscan-sun-500)" : "var(--graphite-700)"}`,
                }}>
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* Filtros activos */}
          {activeFilterCount > 0 && (
            <div className="mb-6 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium" style={{ color: "var(--graphite-400)" }}>
                Filtros activos:
                <HelpTip title="Filtros aplicados" text="Cada chip es un filtro activo sobre el dashboard. Haz click en la X de un chip para quitarlo, o en 'Limpiar todo' para reiniciar todos los filtros. El contador indica cuantos eventos cumplen los filtros." />
              </span>
              {filters.dateFrom && filters.dateFrom !== getDefaultDateFrom() && (
                <button onClick={() => setFilters((prev) => ({ ...prev, dateFrom: getDefaultDateFrom() }))} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all" style={{ backgroundColor: "rgba(247, 183, 8, 0.15)", color: "var(--tuscan-sun-400)", border: "1px solid rgba(247, 183, 8, 0.3)" }}>
                  Desde: {filters.dateFrom} <span className="ml-1 opacity-60">&times;</span>
                </button>
              )}
              {filters.dateTo && filters.dateTo !== getDefaultDateTo() && (
                <button onClick={() => setFilters((prev) => ({ ...prev, dateTo: getDefaultDateTo() }))} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all" style={{ backgroundColor: "rgba(247, 183, 8, 0.15)", color: "var(--tuscan-sun-400)", border: "1px solid rgba(247, 183, 8, 0.3)" }}>
                  Hasta: {filters.dateTo} <span className="ml-1 opacity-60">&times;</span>
                </button>
              )}
              {filters.eventType && (
                <button onClick={() => toggleFilter("eventType", null)} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all" style={{ backgroundColor: "rgba(224, 31, 95, 0.15)", color: "var(--raspberry-red-400)", border: "1px solid rgba(224, 31, 95, 0.3)" }}>
                  {filters.eventType} <span className="ml-1 opacity-60">&times;</span>
                </button>
              )}
              {filters.month && (
                <button onClick={() => toggleFilter("month", null)} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all" style={{ backgroundColor: "rgba(247, 183, 8, 0.15)", color: "var(--tuscan-sun-400)", border: "1px solid rgba(247, 183, 8, 0.3)" }}>
                  {filters.month} <span className="ml-1 opacity-60">&times;</span>
                </button>
              )}
              {filters.category && (
                <button onClick={() => toggleFilter("category", null)} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all" style={{ backgroundColor: "rgba(102, 153, 145, 0.15)", color: "var(--ash-grey-400)", border: "1px solid rgba(102, 153, 145, 0.3)" }}>
                  {filters.category} <span className="ml-1 opacity-60">&times;</span>
                </button>
              )}
              {filters.vehicle && (
                <button onClick={() => toggleFilter("vehicle", null)} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all" style={{ backgroundColor: "rgba(0, 81, 255, 0.15)", color: "var(--crayola-blue-400)", border: "1px solid rgba(0, 81, 255, 0.3)" }}>
                  {filters.vehicle} <span className="ml-1 opacity-60">&times;</span>
                </button>
              )}
              <button onClick={clearFilters} className="text-xs px-2 py-1 rounded-lg cursor-pointer transition-all" style={{ color: "var(--graphite-400)", backgroundColor: "var(--graphite-800)" }}>
                Limpiar todo
              </button>
              <span className="text-xs" style={{ color: "var(--graphite-500)" }}>({filteredEvents.length} de {allEvents.length} eventos)</span>
            </div>
          )}

          {/* KPI Cards */}
          {filteredEvents.length > 0 && indicators.correctiveCount === 0 && (
            <div className="mb-6 px-4 py-3 rounded-xl text-sm flex items-center gap-3" style={{ backgroundColor: "rgba(247, 183, 8, 0.08)", border: "1px solid rgba(247, 183, 8, 0.2)", color: "var(--tuscan-sun-400)" }}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>Los indicadores MTBF y MTTR requieren eventos tipo <strong>Correctivo (Falla imprevista)</strong>. Los {filteredEvents.length} registros actuales son {indicators.preventiveCount > 0 ? "Preventivo" : ""}{indicators.preventiveCount > 0 && indicators.inspectionCount > 0 ? " y " : ""}{indicators.inspectionCount > 0 ? "Inspeccion" : ""}.</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
            {[
              { label: "MTBF", value: formatHours(indicators.mtbf), sub: "Tiempo Medio Entre Fallas", color: "var(--tuscan-sun-400)", bg: "rgba(247, 183, 8, 0.1)", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />, help: "Tiempo Medio Entre Fallas: promedio de horas de operacion entre una falla y la siguiente. Se calcula solo con eventos Correctivos; cuanto mas alto, mas confiable es la flota. Requiere al menos 1 evento Correctivo." },
              { label: "MTTR", value: formatHours(indicators.mttr), sub: "Tiempo Medio de Reparacion", color: "var(--raspberry-red-400)", bg: "rgba(224, 31, 95, 0.1)", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />, help: "Tiempo Medio de Reparacion: promedio de horas entre la deteccion de la falla y la salida del taller en eventos Correctivos. Cuanto mas bajo, mas rapida es la reparacion y menos tiempo pierde la flota." },
              { label: "MTTF", value: formatHours(indicators.mttf), sub: "Tiempo Medio Hasta la Falla", color: "var(--ash-grey-400)", bg: "rgba(102, 153, 145, 0.1)", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />, help: "Tiempo Medio Hasta la Falla: promedio de horas de uso de los componentes reemplazados (accion 'Reemplazado'). Indica cuanto duran las piezas nuevas antes de volver a fallar." },
              { label: "Disponibilidad", value: formatPercent(indicators.availability), sub: "Operativa de la flota", color: "var(--crayola-blue-400)", bg: "rgba(0, 81, 255, 0.1)", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />, help: "Porcentaje de tiempo operativo de la flota: MTBF / (MTBF + MTTR) x 100. Solo se calcula cuando hay eventos Correctivos con reparacion cerrada." },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border p-6 transition-all duration-300 hover:scale-[1.02]" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--graphite-400)" }}>
                      {kpi.label}
                      <HelpTip text={kpi.help} />
                    </p>
                    <p className="text-3xl font-bold mt-2" style={{ color: "var(--graphite-50)" }}>
                      {loadingData ? <span className="inline-block w-16 h-8 rounded-lg animate-pulse" style={{ backgroundColor: "var(--graphite-800)" }} /> : kpi.value}
                    </p>
                    <p className="text-xs mt-2" style={{ color: "var(--graphite-500)" }}>{kpi.sub}</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: kpi.bg }}>
                    <svg className="w-7 h-7" style={{ color: kpi.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">{kpi.icon}</svg>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen */}
          {indicators.totalEvents > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
              {[
                { val: indicators.totalEvents, label: "Total eventos", color: "var(--tuscan-sun-400)", help: "Total de eventos que coinciden con los filtros activos." },
                { val: indicators.correctiveCount, label: "Correctivos", color: "var(--raspberry-red-400)", help: "Fallas imprevistas reparadas; son los que alimentan los indicadores MTBF y MTTR." },
                { val: indicators.preventiveCount, label: "Preventivos", color: "var(--ash-grey-400)", help: "Mantenimientos programados realizados para prevenir fallas." },
                { val: indicators.inspectionCount, label: "Inspecciones", color: "var(--crayola-blue-400)", help: "Revisiones periodicas del vehiculo; no afectan los indicadores de confiabilidad." },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border p-4 text-center" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--graphite-500)" }}>
                    {s.label}
                    <HelpTip text={s.help} />
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <EventTypePieChart data={pieData} onFilter={(key) => toggleFilter("eventType", key)} activeFilter={filters.eventType} helpText="Cuenta los eventos del periodo por tipo: Correctivo, Preventivo, Inspeccion y Predictivo. Haz click en un segmento o en su leyenda para filtrar todo el dashboard por ese tipo; vuelve a hacer click para quitar el filtro." />
            <MonthlyEventsChart data={barData} onFilter={(key) => toggleFilter("month", key)} activeFilter={filters.month} helpText="Cuantos eventos se registraron en cada mes del periodo. Haz click en una barra para filtrar todo el dashboard por ese mes; haz click de nuevo para quitar el filtro." />
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <TrendChart data={trendData} helpText="Evolucion mensual de los indicadores de confiabilidad: MTBF (horas entre fallas, cuanto mas alto mejor) y MTTR (horas de reparacion, cuanto mas bajo mejor). Se calcula solo con eventos Correctivos cerrados." />
            <CostByCategoryChart data={costData} onFilter={(key) => toggleFilter("category", CATEGORY_ES_TO_KEY[key] ?? null)} activeFilter={filters.category ? (Object.entries(CATEGORY_ES_TO_KEY).find(([_, v]) => v === filters.category)?.[0] ?? null) : null} helpText="Costo acumulado de reparaciones por sistema del vehiculo (Motor, Frenos, Electrico...). Haz click en una barra para filtrar todo el dashboard por esa categoria." />
          </div>

          {/* Charts Row 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-10">
            <TopVehiclesChart data={vehicleData} onFilter={(key) => toggleFilter("vehicle", key)} activeFilter={filters.vehicle} helpText="Los 5 vehiculos con mas eventos registrados en el periodo. Haz click en una barra para filtrar todo el dashboard por ese vehiculo." />

            {/* Welcome + Seed + Export */}
            <div className="rounded-2xl border p-8 flex flex-col items-center justify-center text-center" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(247, 183, 8, 0.1)" }}>
                <svg className="w-8 h-8" style={{ color: "var(--tuscan-sun-400)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--graphite-50)" }}>Bienvenido, {user?.displayName?.split(" ")[0]}</h3>
              <p className="text-sm mb-5" style={{ color: "var(--graphite-400)" }}>Registra eventos o genera datos de prueba para ver los indicadores en accion.</p>
              <div className="flex flex-col gap-3 w-full">
                <a href="/maintenance/new" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Registrar Mantenimiento
                </a>
                <button onClick={handleSeed} disabled={seeding}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--graphite-800)", color: "var(--graphite-300)", border: "1px solid var(--graphite-700)" }}
                >
                  {seeding ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Generando...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>Generar 10 reportes de prueba</>
                  )}
                </button>
                <button onClick={handleExport} disabled={filteredEvents.length === 0}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "rgba(102, 153, 145, 0.15)", color: "var(--ash-grey-400)", border: "1px solid rgba(102, 153, 145, 0.3)" }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Descargar Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {closeEvent && (
        <CloseEventModal event={closeEvent} onSuccess={() => { setCloseEvent(null); loadData(); }} onCancel={() => setCloseEvent(null)} />
      )}
    </AuthGuard>
  );
}
