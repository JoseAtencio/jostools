"use client";

import { useState, useEffect, useMemo, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import CloseEventModal from "@/components/CloseEventModal";
import ReopenEventModal from "@/components/ReopenEventModal";
import ExportFormatModal from "@/components/ExportFormatModal";
import HelpTip from "@/components/HelpTip";
import { useAppSelector } from "@/lib/redux/hooks";
import { getMaintenanceEvents, exportEventsToExcel } from "@/lib/services/maintenanceService";
import { exportEventsToPdf } from "@/lib/services/pdfExportService";
import { calculateIndicators } from "@/lib/services/indicatorService";
import { EVENT_TYPE_LABELS, EVENT_TYPE_SHORT_LABELS, SYSTEM_CATEGORY_LABELS, EVENT_STATUS_LABELS, BLOCK_REASON_LABELS, type MaintenanceEvent, type EventType } from "@/types/maintenance";

type TableSortKey =
  | "vehicle_id"
  | "event_type"
  | "failure_timestamp"
  | "system_category"
  | "repair_cost"
  | "status"
  | "workshop_entry_time"
  | "workshop_exit_time"
  | "effective_work_hours"
  | "edited_at";

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function shortDate(iso: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--" : d.toLocaleDateString("es-ES");
}

type ActionTipState = { text: string; x: number; y: number } | null;

function ActionButton({
  enabled,
  label,
  tipEnabled,
  tipDisabled,
  colors,
  onClick,
  setTip,
  children,
}: {
  enabled: boolean;
  label: string;
  tipEnabled: string;
  tipDisabled: string;
  colors: { bg: string; fg: string; border: string; hoverBg: string };
  onClick: () => void;
  setTip: Dispatch<SetStateAction<ActionTipState>>;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const style = !enabled
    ? { backgroundColor: "var(--graphite-800)", color: "var(--graphite-600)", border: "1px solid var(--graphite-700)", cursor: "not-allowed" }
    : hover
      ? { backgroundColor: colors.hoverBg, color: "var(--graphite-950)", border: `1px solid ${colors.hoverBg}`, cursor: "pointer" }
      : { backgroundColor: colors.bg, color: colors.fg, border: `1px solid ${colors.border}`, cursor: "pointer" };
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={!enabled}
      onClick={() => { if (enabled) onClick(); }}
      onMouseEnter={(e) => { setHover(true); setTip({ text: enabled ? tipEnabled : tipDisabled, x: e.clientX, y: e.clientY }); }}
      onMouseMove={(e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
      onMouseLeave={() => { setHover(false); setTip(null); }}
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
      style={style}
    >
      {children}
    </button>
  );
}

export default function RecordsPage() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<TableSortKey>("failure_timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [closeEvent, setCloseEvent] = useState<MaintenanceEvent | null>(null);
  const [reopenEvent, setReopenEvent] = useState<MaintenanceEvent | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [actionTip, setActionTip] = useState<ActionTipState>(null);
  const [showGuide, setShowGuide] = useState(true);

  const loadData = () => {
    if (!user?.enterpriseId) return;
    getMaintenanceEvents(user.enterpriseId).then((e) => { setEvents(e); setLoading(false); });
  };

  useEffect(() => { loadData(); }, [user?.enterpriseId]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      const d = new Date(e.failure_timestamp);
      if (!Number.isNaN(d.getTime())) set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    return Array.from(set).sort().reverse();
  }, [events]);

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-");
    return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
  };

  const filtered = useMemo(() => {
    let result = events;
    if (month) {
      result = result.filter((e) => {
        const d = new Date(e.failure_timestamp);
        return !Number.isNaN(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === month;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.vehicle_id.toLowerCase().includes(q) ||
        (EVENT_TYPE_LABELS[e.event_type] ?? "").toLowerCase().includes(q) ||
        (SYSTEM_CATEGORY_LABELS[e.system_category] ?? "").toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [events, search, month, sortKey, sortDir]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((e) => next.delete(e.id));
      else filtered.forEach((e) => next.add(e.id));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedEvents = useMemo(() => events.filter((e) => selected.has(e.id)), [events, selected]);

  const handleExport = (format: "excel" | "pdf") => {
    if (format === "excel") exportEventsToExcel(selectedEvents, calculateIndicators(selectedEvents));
    else exportEventsToPdf(selectedEvents, "Seleccion de eventos");
    setExportOpen(false);
  };

  const handleSort = (key: TableSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: TableSortKey }) => (
    <span className="ml-1 inline-block" style={{ color: sortKey === col ? "var(--tuscan-sun-400)" : "var(--graphite-600)" }}>
      {sortKey === col ? (sortDir === "asc" ? "\u25B2" : "\u25BC") : "\u25B4"}
    </span>
  );

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: "var(--graphite-950)" }}>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold" style={{ color: "var(--graphite-100)" }}>
              Registros de Mantenimiento
              <HelpTip title="Bitacora de eventos" text="Todos los eventos de mantenimiento de la empresa. Haz click en cualquier fila para ver el detalle completo del evento. Puedes buscar, filtrar por mes, ordenar por columna y seleccionar eventos para exportarlos en Excel o PDF." />
            </h1>
            <span className="text-sm" style={{ color: "var(--graphite-500)" }}>{filtered.length} registros</span>
          </div>

          <div className="mb-6 rounded-xl border" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--tuscan-sun-400)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold" style={{ color: "var(--graphite-200)" }}>Que hace cada accion</span>
              </div>
              <button
                onClick={() => setShowGuide((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                style={{ backgroundColor: "var(--graphite-800)", color: "var(--graphite-400)", border: "1px solid var(--graphite-700)" }}
              >
                {showGuide ? "Ocultar" : "Mostrar"}
                <svg className="w-3 h-3" style={{ transform: showGuide ? "rotate(0deg)" : "rotate(180deg)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>
            {showGuide && (
              <>
                <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {([
                    {
                      name: "Editar",
                      desc: "Abre el formulario para corregir un evento abierto. Los eventos cerrados no se pueden editar; reabrielos primero.",
                      bg: "rgba(0, 81, 255, 0.12)",
                      color: "var(--crayola-blue-400)",
                      icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
                    },
                    {
                      name: "Cerrar",
                      desc: "Registra la salida del taller con fecha, horas efectivas y costo final. Solo disponible en eventos abiertos.",
                      bg: "rgba(102, 153, 145, 0.15)",
                      color: "var(--ash-grey-400)",
                      icon: "M5 13l4 4L19 7",
                    },
                    {
                      name: "Reabrir",
                      desc: "Vuelve un evento cerrado a estado abierto para poder corregirlo. Pide confirmacion antes de aplicar.",
                      bg: "rgba(224, 31, 95, 0.12)",
                      color: "var(--raspberry-red-400)",
                      icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
                    },
                    {
                      name: "Seleccionar",
                      desc: "Marca filas con los checkboxes y usa 'Exportar seleccion' para descargarlas en Excel o PDF.",
                      bg: "rgba(247, 183, 8, 0.12)",
                      color: "var(--tuscan-sun-400)",
                      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
                    },
                  ]).map((item) => (
                    <div key={item.name} className="flex items-start gap-2.5">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: item.bg, color: item.color }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold" style={{ color: item.color }}>{item.name}</p>
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--graphite-400)" }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="px-4 pb-4 text-xs" style={{ color: "var(--graphite-500)" }}>
                  Haz click en cualquier fila para ver el detalle completo. Tambien puedes buscar, ordenar por columna y filtrar por mes.
                </p>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap mb-6">
            <div className="relative w-full max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--graphite-500)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por vehiculo o tipo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
                style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}
              />
            </div>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-4 py-2 rounded-xl text-sm outline-none cursor-pointer"
              style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}
            >
              <option value="">Todos los meses</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>

          {selected.size > 0 && (
            <div className="mb-4 flex items-center gap-3 flex-wrap px-4 py-3 rounded-xl" style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--tuscan-sun-500)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--tuscan-sun-400)" }}>
                {selected.size} evento{selected.size === 1 ? "" : "s"} seleccionado{selected.size === 1 ? "" : "s"}
              </span>
              <button
                onClick={() => setExportOpen(true)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}
              >
                Exportar seleccion
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                style={{ backgroundColor: "var(--graphite-800)", color: "var(--graphite-400)", border: "1px solid var(--graphite-700)" }}
              >
                Limpiar
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-20" style={{ color: "var(--graphite-500)" }}>Cargando registros...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 rounded-xl" style={{ color: "var(--graphite-500)", border: "1px solid var(--graphite-800)", backgroundColor: "var(--graphite-900)" }}>
              <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--graphite-700)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              No se encontraron registros
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--graphite-800)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1080px]">
                  <thead>
                    <tr style={{ backgroundColor: "var(--graphite-900)" }}>
                      <th className="px-3 py-3.5 w-10">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisible}
                          className="cursor-pointer"
                          style={{ accentColor: "var(--tuscan-sun-500)" }}
                        />
                      </th>
                      {([
                        { key: "vehicle_id" as TableSortKey, label: "Vehiculo" },
                        { key: "event_type" as TableSortKey, label: "Tipo" },
                        { key: "status" as TableSortKey, label: "Estado" },
                        { key: "failure_timestamp" as TableSortKey, label: "Falla" },
                        { key: "workshop_entry_time" as TableSortKey, label: "Entrada" },
                        { key: "workshop_exit_time" as TableSortKey, label: "Salida" },
                        { key: "effective_work_hours" as TableSortKey, label: "Horas", align: "right" as const },
                        { key: "system_category" as TableSortKey, label: "Categoria" },
                        { key: "repair_cost" as TableSortKey, label: "Costo", align: "right" as const },
                        { key: "edited_at" as TableSortKey, label: "Ediciones" },
                      ]).map((col) => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className={`px-3 py-3.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${col.align === "right" ? "text-right" : "text-left"}`}
                          style={{ color: sortKey === col.key ? "var(--graphite-200)" : "var(--graphite-400)" }}
                        >
                          {col.label}<SortIcon col={col.key} />
                        </th>
                      ))}
                      <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--graphite-400)" }}>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((event) => {
                      const isOpen = !event.status || event.status === "PENDING";
                      const isClosed = event.status === "COMPLETED";
                      return (
                      <tr
                        key={event.id}
                        className="transition-colors cursor-pointer"
                        style={{ borderTop: "1px solid var(--graphite-800)" }}
                        onClick={() => router.push(`/records/${event.id}`)}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--graphite-900)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(event.id)}
                            onChange={() => toggleOne(event.id)}
                            className="cursor-pointer"
                            style={{ accentColor: "var(--tuscan-sun-500)" }}
                          />
                        </td>
                        <td className="px-3 py-3 font-mono text-[13px] font-semibold tracking-wide" style={{ color: "var(--graphite-100)" }}>{event.vehicle_id}</td>
                        <td className="px-3 py-3">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                            title={EVENT_TYPE_LABELS[event.event_type]}
                            style={{
                              backgroundColor: event.event_type === "CORRECTIVE" ? "rgba(224, 31, 95, 0.15)" : event.event_type === "PREVENTIVE" ? "rgba(0, 81, 255, 0.15)" : event.event_type === "PREDICTIVE" ? "rgba(102, 153, 145, 0.15)" : "var(--graphite-800)",
                              color: event.event_type === "CORRECTIVE" ? "var(--raspberry-red-400)" : event.event_type === "PREVENTIVE" ? "var(--crayola-blue-400)" : event.event_type === "PREDICTIVE" ? "var(--ash-grey-400)" : "var(--graphite-300)",
                            }}
                          >
                            {EVENT_TYPE_SHORT_LABELS[event.event_type]}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                            style={{
                              backgroundColor: event.status === "PENDING" ? "rgba(247, 183, 8, 0.15)" : "rgba(102, 153, 145, 0.15)",
                              color: event.status === "PENDING" ? "var(--tuscan-sun-400)" : "var(--ash-grey-400)",
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "currentColor" }} />
                            {EVENT_STATUS_LABELS[event.status || "PENDING"]}
                          </span>
                          {event.block_reason ? (
                            <span
                              className="ml-1.5 inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap cursor-help"
                              title={`Bloqueado: ${BLOCK_REASON_LABELS[event.block_reason] ?? event.block_reason}`}
                              style={{ backgroundColor: "rgba(224, 31, 95, 0.12)", color: "var(--raspberry-red-400)" }}
                            >
                              Bloqueado
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap" style={{ color: "var(--graphite-300)" }}>{shortDate(event.failure_timestamp)}</td>
                        <td className="px-3 py-3 whitespace-nowrap" style={{ color: "var(--graphite-300)" }}>{shortDate(event.workshop_entry_time)}</td>
                        <td className="px-3 py-3 whitespace-nowrap" style={{ color: event.workshop_exit_time ? "var(--graphite-300)" : "var(--graphite-600)" }}>{event.workshop_exit_time ? shortDate(event.workshop_exit_time) : "--"}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums" style={{ color: event.effective_work_hours != null ? "var(--graphite-300)" : "var(--graphite-600)" }}>{event.effective_work_hours != null ? `${event.effective_work_hours} h` : "--"}</td>
                        <td className="px-3 py-3" style={{ color: "var(--graphite-300)" }}>{SYSTEM_CATEGORY_LABELS[event.system_category] ?? event.system_category ?? "--"}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums whitespace-nowrap" style={{ color: "var(--graphite-100)" }}>${event.repair_cost.toLocaleString("es-ES")}</td>
                        <td className="px-3 py-3">
                          {event.edited_at ? (
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap cursor-help"
                              style={{ backgroundColor: "rgba(0, 81, 255, 0.12)", color: "var(--crayola-blue-400)" }}
                              title={`Ultima edicion: ${new Date(event.edited_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })} por ${event.edited_by || "Usuario"}`}
                            >
                              Editado{event.edit_history && event.edit_history.length > 1 ? ` (${event.edit_history.length})` : ""}
                            </span>
                          ) : (
                            <span style={{ color: "var(--graphite-600)" }}>--</span>
                          )}
                        </td>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 flex-nowrap">
                            <ActionButton
                              enabled={isOpen}
                              label="Editar evento"
                              tipEnabled="Editar: abre el formulario para corregir los datos del evento"
                              tipDisabled="No disponible: el evento esta cerrado. Reabrielo para editarlo."
                              colors={{ bg: "rgba(0, 81, 255, 0.12)", fg: "var(--crayola-blue-400)", border: "rgba(0, 81, 255, 0.3)", hoverBg: "var(--crayola-blue-400)" }}
                              onClick={() => router.push(`/records/${event.id}/editar`)}
                              setTip={setActionTip}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </ActionButton>
                            <ActionButton
                              enabled={isOpen}
                              label="Cerrar evento"
                              tipEnabled="Cerrar: registra la salida del taller, horas efectivas y costo final"
                              tipDisabled="No disponible: el evento ya esta cerrado."
                              colors={{ bg: "rgba(102, 153, 145, 0.15)", fg: "var(--ash-grey-400)", border: "rgba(102, 153, 145, 0.3)", hoverBg: "var(--ash-grey-400)" }}
                              onClick={() => setCloseEvent(event)}
                              setTip={setActionTip}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </ActionButton>
                            <ActionButton
                              enabled={isClosed}
                              label="Reabrir evento"
                              tipEnabled="Reabrir: vuelve el evento a estado abierto para poder corregirlo"
                              tipDisabled="No disponible: el evento sigue abierto."
                              colors={{ bg: "rgba(224, 31, 95, 0.12)", fg: "var(--raspberry-red-400)", border: "rgba(224, 31, 95, 0.3)", hoverBg: "var(--raspberry-red-400)" }}
                              onClick={() => setReopenEvent(event)}
                              setTip={setActionTip}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {actionTip && (
          <div
            className="fixed z-50 pointer-events-none max-w-[280px] rounded-lg border px-2.5 py-1.5 text-xs leading-relaxed shadow-xl"
            style={{
              left: actionTip.x,
              top: actionTip.y - 8,
              transform: "translate(-50%, -100%)",
              backgroundColor: "var(--graphite-900)",
              borderColor: "var(--graphite-700)",
              color: "var(--graphite-200)",
            }}
          >
            {actionTip.text}
          </div>
        )}
      </div>

      {closeEvent && (
        <CloseEventModal event={closeEvent} onSuccess={() => { setCloseEvent(null); loadData(); }} onCancel={() => setCloseEvent(null)} />
      )}
      {reopenEvent && (
        <ReopenEventModal event={reopenEvent} onSuccess={() => { setReopenEvent(null); loadData(); }} onCancel={() => setReopenEvent(null)} />
      )}
      {exportOpen && (
        <ExportFormatModal count={selected.size} titulo="seleccion" onCancel={() => setExportOpen(false)} onExport={handleExport} />
      )}
    </AuthGuard>
  );
}
