"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import CloseEventModal from "@/components/CloseEventModal";
import ExportFormatModal from "@/components/ExportFormatModal";
import HelpTip from "@/components/HelpTip";
import { useAppSelector } from "@/lib/redux/hooks";
import { getMaintenanceEvents, exportEventsToExcel } from "@/lib/services/maintenanceService";
import { exportEventsToPdf } from "@/lib/services/pdfExportService";
import { calculateIndicators } from "@/lib/services/indicatorService";
import { EVENT_TYPE_LABELS, SYSTEM_CATEGORY_LABELS, EVENT_STATUS_LABELS, type MaintenanceEvent, type EventType } from "@/types/maintenance";

type TableSortKey =
  | "vehicle_id"
  | "event_type"
  | "failure_timestamp"
  | "system_category"
  | "repair_cost"
  | "status"
  | "workshop_entry_time"
  | "workshop_exit_time"
  | "effective_work_hours";

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function shortDate(iso: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--" : d.toLocaleDateString("es-ES");
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
  const [exportOpen, setExportOpen] = useState(false);

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

          <div className="flex items-center gap-3 flex-wrap mb-6">
            <input
              type="text"
              placeholder="Buscar por vehiculo o tipo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-xs px-4 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}
            />
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
            <div className="text-center py-20" style={{ color: "var(--graphite-500)" }}>No se encontraron registros</div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--graphite-800)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: "var(--graphite-900)" }}>
                      <th className="px-3 py-3">
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
                        { key: "failure_timestamp" as TableSortKey, label: "Fecha Falla" },
                        { key: "workshop_entry_time" as TableSortKey, label: "Entrada" },
                        { key: "workshop_exit_time" as TableSortKey, label: "Salida" },
                        { key: "effective_work_hours" as TableSortKey, label: "Horas" },
                        { key: "system_category" as TableSortKey, label: "Categoria" },
                        { key: "repair_cost" as TableSortKey, label: "Costo" },
                      ]).map((col) => (
                        <th key={col.key} onClick={() => handleSort(col.key)} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--graphite-400)" }}>
                          {col.label}<SortIcon col={col.key} />
                        </th>
                      ))}
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--graphite-400)" }}>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((event) => (
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
                        <td className="px-3 py-3 font-medium" style={{ color: "var(--graphite-100)" }}>{event.vehicle_id}</td>
                        <td className="px-3 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{
                            backgroundColor: event.event_type === "CORRECTIVE" ? "rgba(224, 31, 95, 0.15)" : event.event_type === "PREVENTIVE" ? "rgba(0, 81, 255, 0.15)" : "rgba(102, 153, 145, 0.15)",
                            color: event.event_type === "CORRECTIVE" ? "var(--raspberry-red-400)" : event.event_type === "PREVENTIVE" ? "var(--crayola-blue-400)" : "var(--ash-grey-400)",
                          }}>
                            {EVENT_TYPE_LABELS[event.event_type]}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                            backgroundColor: event.status === "PENDING" ? "rgba(247, 183, 8, 0.15)" : "rgba(102, 153, 145, 0.15)",
                            color: event.status === "PENDING" ? "var(--tuscan-sun-400)" : "var(--ash-grey-400)",
                          }}>
                            {EVENT_STATUS_LABELS[event.status || "PENDING"]}
                          </span>
                        </td>
                        <td className="px-3 py-3" style={{ color: "var(--graphite-300)" }}>{shortDate(event.failure_timestamp)}</td>
                        <td className="px-3 py-3" style={{ color: "var(--graphite-300)" }}>{shortDate(event.workshop_entry_time)}</td>
                        <td className="px-3 py-3" style={{ color: "var(--graphite-300)" }}>{event.workshop_exit_time ? shortDate(event.workshop_exit_time) : "--"}</td>
                        <td className="px-3 py-3" style={{ color: "var(--graphite-300)" }}>{event.effective_work_hours != null ? `${event.effective_work_hours} h` : "--"}</td>
                        <td className="px-3 py-3" style={{ color: "var(--graphite-300)" }}>{SYSTEM_CATEGORY_LABELS[event.system_category]}</td>
                        <td className="px-3 py-3 font-medium" style={{ color: "var(--graphite-200)" }}>${event.repair_cost.toLocaleString("es-ES")}</td>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          {(event.status === "PENDING" || !event.status) && (
                            <button onClick={() => setCloseEvent(event)} className="px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all" style={{ backgroundColor: "rgba(102, 153, 145, 0.15)", color: "var(--ash-grey-400)", border: "1px solid rgba(102, 153, 145, 0.3)" }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--ash-grey-400)"; e.currentTarget.style.color = "var(--graphite-950)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(102, 153, 145, 0.15)"; e.currentTarget.style.color = "var(--ash-grey-400)"; }}
                            >
                              Cerrar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {closeEvent && (
        <CloseEventModal event={closeEvent} onSuccess={() => { setCloseEvent(null); loadData(); }} onCancel={() => setCloseEvent(null)} />
      )}
      {exportOpen && (
        <ExportFormatModal count={selected.size} titulo="seleccion" onCancel={() => setExportOpen(false)} onExport={handleExport} />
      )}
    </AuthGuard>
  );
}
