"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import CloseEventModal from "@/components/CloseEventModal";
import { useAppSelector } from "@/lib/redux/hooks";
import { getMaintenanceEvents } from "@/lib/services/maintenanceService";
import { EVENT_TYPE_LABELS, SYSTEM_CATEGORY_LABELS, EVENT_STATUS_LABELS, type MaintenanceEvent, type EventType } from "@/types/maintenance";

type TableSortKey = "vehicle_id" | "event_type" | "failure_timestamp" | "system_category" | "repair_cost" | "status";

export default function RecordsPage() {
  const { user } = useAppSelector((state) => state.auth);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<TableSortKey>("failure_timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [closeEvent, setCloseEvent] = useState<MaintenanceEvent | null>(null);

  const loadData = () => {
    if (!user?.enterpriseId) return;
    getMaintenanceEvents(user.enterpriseId).then((e) => { setEvents(e); setLoading(false); });
  };

  useEffect(() => { loadData(); }, [user?.enterpriseId]);

  const filtered = useMemo(() => {
    let result = events;
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
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [events, search, sortKey, sortDir]);

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
            <h1 className="text-2xl font-bold" style={{ color: "var(--graphite-100)" }}>Registros de Mantenimiento</h1>
            <span className="text-sm" style={{ color: "var(--graphite-500)" }}>{filtered.length} registros</span>
          </div>

          <input
            type="text"
            placeholder="Buscar por vehiculo o tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 rounded-xl text-sm outline-none mb-6"
            style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}
          />

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
                      {([
                        { key: "vehicle_id" as TableSortKey, label: "Vehiculo" },
                        { key: "event_type" as TableSortKey, label: "Tipo" },
                        { key: "status" as TableSortKey, label: "Estado" },
                        { key: "failure_timestamp" as TableSortKey, label: "Fecha Falla" },
                        { key: "system_category" as TableSortKey, label: "Categoria" },
                        { key: "repair_cost" as TableSortKey, label: "Costo" },
                      ]).map((col) => (
                        <th key={col.key} onClick={() => handleSort(col.key)} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--graphite-400)" }}>
                          {col.label}<SortIcon col={col.key} />
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--graphite-400)" }}>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((event) => (
                      <tr key={event.id} className="transition-colors" style={{ borderTop: "1px solid var(--graphite-800)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--graphite-900)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--graphite-100)" }}>{event.vehicle_id}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                            backgroundColor: event.event_type === "CORRECTIVE" ? "rgba(224, 31, 95, 0.15)" : event.event_type === "PREVENTIVE" ? "rgba(0, 81, 255, 0.15)" : "rgba(102, 153, 145, 0.15)",
                            color: event.event_type === "CORRECTIVE" ? "var(--raspberry-red-400)" : event.event_type === "PREVENTIVE" ? "var(--crayola-blue-400)" : "var(--ash-grey-400)",
                          }}>
                            {EVENT_TYPE_LABELS[event.event_type]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                            backgroundColor: event.status === "PENDING" ? "rgba(247, 183, 8, 0.15)" : "rgba(102, 153, 145, 0.15)",
                            color: event.status === "PENDING" ? "var(--tuscan-sun-400)" : "var(--ash-grey-400)",
                          }}>
                            {EVENT_STATUS_LABELS[event.status || "PENDING"]}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--graphite-300)" }}>{new Date(event.failure_timestamp).toLocaleDateString("es-ES")}</td>
                        <td className="px-4 py-3" style={{ color: "var(--graphite-300)" }}>{SYSTEM_CATEGORY_LABELS[event.system_category]}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--graphite-200)" }}>${event.repair_cost.toLocaleString("es-ES")}</td>
                        <td className="px-4 py-3">
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
    </AuthGuard>
  );
}
