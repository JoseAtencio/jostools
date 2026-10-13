"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import HelpTip from "@/components/HelpTip";
import FleetGroupConfig from "@/components/FleetGroupConfig";
import EventTypePieChart from "@/components/charts/EventTypePieChart";
import { useAppSelector } from "@/lib/redux/hooks";
import { getMaintenanceEvents } from "@/lib/services/maintenanceService";
import { getVehicles } from "@/lib/services/vehicleService";
import { getEventTypePieData, formatHours } from "@/lib/services/indicatorService";
import { buildReport, getMonthOptions, monthLabelOf, generateConclusions, type ReportGroup } from "@/lib/services/reportService";
import { exportReportToPdf, exportReportToExcel } from "@/lib/services/reportExportService";
import { SYSTEM_CATEGORY_LABELS, BLOCK_REASON_LABELS, EVENT_STATUS_LABELS, type MaintenanceEvent } from "@/types/maintenance";
import type { Vehicle } from "@/types/vehicle";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const kpiCard = (label: string, value: string, help: string) => (
  <div key={label} className="rounded-2xl border p-4" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
    <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--graphite-500)" }}>
      {label}
      <HelpTip title={label} text={help} />
    </p>
    <p className="text-xl font-bold" style={{ color: "var(--graphite-100)" }}>{value}</p>
  </div>
);

function ReportBarChart({ data }: { data: ReportGroup[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--graphite-800)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} stroke="#6b6b70" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={150} stroke="#6b6b70" tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1b1819", border: "1px solid #4a4446", borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: "#f4f4f5" }}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey="count" fill="#F7B708" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function eventRows(list: MaintenanceEvent[]) {
  return list.map((e) => ({
    Vehiculo: e.vehicle_id,
    Falla: new Date(e.failure_timestamp).toLocaleDateString("es-ES"),
    Sistema: SYSTEM_CATEGORY_LABELS[e.system_category] ?? e.system_category,
    Estado: EVENT_STATUS_LABELS[e.status || "PENDING"],
    Observacion: e.observation?.trim() || "--",
  }));
}

export default function ReportsPage() {
  const { user } = useAppSelector((state) => state.auth);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState("");
  const [conclusions, setConclusions] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const pieRef = useRef<HTMLDivElement>(null);
  const flotaRef = useRef<HTMLDivElement>(null);
  const sistemaRef = useRef<HTMLDivElement>(null);

  const loadData = () => {
    if (!user?.enterpriseId) return;
    Promise.all([getMaintenanceEvents(user.enterpriseId), getVehicles(user.enterpriseId)]).then(([evs, vehs]) => {
      setEvents(evs);
      setVehicles(vehs);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
      setError("No se pudo cargar la informacion del informe.");
    });
  };

  useEffect(() => { loadData(); }, [user?.enterpriseId]);

  const monthOptions = useMemo(() => getMonthOptions(events), [events]);

  useEffect(() => {
    if (monthOptions.length > 0 && !monthKey) setMonthKey(monthOptions[0]);
  }, [monthOptions, monthKey]);

  const report = useMemo(() => buildReport(events, vehicles, monthKey), [events, vehicles, monthKey]);

  useEffect(() => {
    if (report) setConclusions(generateConclusions(report));
  }, [report?.monthKey]);

  const handleExportPdf = async () => {
    if (!report) return;
    setExporting("pdf");
    try {
      await exportReportToPdf(report, conclusions, [pieRef.current, flotaRef.current, sistemaRef.current]);
    } catch {
      alert("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = () => {
    if (!report) return;
    setExporting("excel");
    try {
      exportReportToExcel(report, conclusions);
    } catch {
      alert("No se pudo generar el Excel. Intenta de nuevo.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: "var(--graphite-950)" }}>
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h1 className="text-2xl font-bold" style={{ color: "var(--graphite-100)" }}>
              Informe Mensual
              <HelpTip title="Informe mensual" text="Informe automatico del mes, igual al PDF que se hacia a mano: resumen, preventivos, correctivos, distribucion por flota y sistema, backlog y conclusiones. Elige el mes, revisa los numeros, edita las conclusiones si quieres y exporta en PDF o Excel." />
            </h1>
            <div className="flex items-center gap-3">
              <select
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                className="px-4 py-2 rounded-xl text-sm outline-none cursor-pointer"
                style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}
              >
                <option value="">Selecciona un mes</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{monthLabelOf(m)}</option>
                ))}
              </select>
              <button
                onClick={handleExportPdf}
                disabled={!report || exporting !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all disabled:opacity-50"
                style={{ backgroundColor: "rgba(0, 81, 255, 0.15)", color: "var(--crayola-blue-400)", border: "1px solid rgba(0, 81, 255, 0.3)" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {exporting === "pdf" ? "Generando..." : "Exportar PDF"}
              </button>
              <button
                onClick={handleExportExcel}
                disabled={!report || exporting !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all disabled:opacity-50"
                style={{ backgroundColor: "rgba(102, 153, 145, 0.15)", color: "var(--ash-grey-400)", border: "1px solid rgba(102, 153, 145, 0.3)" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {exporting === "excel" ? "Generando..." : "Exportar Excel"}
              </button>
            </div>
          </div>

          {!loading && vehicles.length > 0 && <FleetGroupConfig vehicles={vehicles} onSaved={loadData} />}

          {error ? (
            <div className="text-center py-20 rounded-xl" style={{ color: "var(--raspberry-red-400)", border: "1px solid var(--graphite-800)", backgroundColor: "var(--graphite-900)" }}>
              {error}
            </div>
          ) : loading ? (
            <div className="text-center py-20" style={{ color: "var(--graphite-500)" }}>Cargando informe...</div>
          ) : !report ? (
            <div className="text-center py-20 rounded-xl" style={{ color: "var(--graphite-500)", border: "1px solid var(--graphite-800)", backgroundColor: "var(--graphite-900)" }}>
              Selecciona un mes para generar el informe
            </div>
          ) : report.total === 0 ? (
            <div className="text-center py-20 rounded-xl" style={{ color: "var(--graphite-500)", border: "1px solid var(--graphite-800)", backgroundColor: "var(--graphite-900)" }}>
              No hay eventos registrados en {report.monthLabel}
            </div>
          ) : (
            <>
              <div className="mb-6 p-5 rounded-2xl border" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                  <h2 className="text-lg font-bold" style={{ color: "var(--graphite-100)" }}>Informe Mensual de Mantenimiento e Infraestructura</h2>
                  <span className="text-sm" style={{ color: "var(--graphite-400)" }}>
                    {report.monthLabel} | Generado: {new Date().toLocaleDateString("es-ES")}
                  </span>
                </div>
                <p className="text-sm" style={{ color: "var(--graphite-500)" }}>Fuente: eventos de mantenimiento de la empresa</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {kpiCard("Total", String(report.total), "Intervenciones registradas con fecha de falla en el mes.")}
                {kpiCard("Preventivos", `${report.preventivePct}%`, "Porcentaje de eventos tipo Preventivo sobre el total del mes.")}
                {kpiCard("Correctivos", `${report.correctivePct}%`, "Porcentaje de eventos tipo Correctivo sobre el total del mes.")}
                {kpiCard("Eficiencia de cierre", report.closureEfficiency != null ? `${report.closureEfficiency}%` : "--", "Eventos cerrados en el mes dividido entre los que estuvieron en taller durante el mes, por 100.")}
                {kpiCard("Backlog", String(report.backlog.length), "Eventos abiertos o cerrados con motivo de bloqueo: todavia tienen trabajo pendiente.")}
                {kpiCard("Costo del mes", `$${report.costTotal.toLocaleString("es-ES")}`, "Suma de costos de reparacion de los eventos del mes.")}
              </div>

              <div className="mb-4 p-4 rounded-2xl border" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <p className="text-sm mb-2 font-semibold" style={{ color: "var(--graphite-300)" }}>Indicadores del mes</p>
                <p className="text-sm" style={{ color: "var(--graphite-400)" }}>
                  MTTR: {report.indicators.mttr != null ? formatHours(report.indicators.mttr) : "--"}
                  {" | "}MTBF: {report.indicators.mtbf != null ? formatHours(report.indicators.mtbf) : "--"}
                  {" | "}Disponibilidad: {report.indicators.availability != null ? `${report.indicators.availability}%` : "--"}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div ref={pieRef} className="rounded-2xl" style={{ backgroundColor: "var(--graphite-900)" }}>
                  <EventTypePieChart data={getEventTypePieData(report.events)} />
                </div>
                <div ref={flotaRef} className="rounded-2xl border p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                  <p className="text-sm font-semibold mb-3" style={{ color: "var(--graphite-200)" }}>
                    Distribucion por flota
                    <HelpTip title="Distribucion por flota" text="Eventos del mes agrupados por el grupo de flota del vehiculo (MQ, VP-EP-VB-VC, VL-TP, Maquinaria...). Los vehiculos sin grupo aparecen como 'Sin grupo'." />
                  </p>
                  <ReportBarChart data={report.byFleetGroup} />
                </div>
                <div ref={sistemaRef} className="rounded-2xl border p-6 lg:col-span-2" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                  <p className="text-sm font-semibold mb-3" style={{ color: "var(--graphite-200)" }}>
                    Distribucion por sistema afectado
                    <HelpTip title="Distribucion por sistema" text="Eventos del mes agrupados por el sistema del vehiculo donde ocurrio la falla (Motor, Frenos, Electrico...)." />
                  </p>
                  <ReportBarChart data={report.bySystem} />
                </div>
              </div>

              <div className="mb-6 rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--graphite-800)" }}>
                  <h2 className="text-sm font-bold" style={{ color: "var(--graphite-100)" }}>
                    Seccion 1 - Preventivos ({report.preventive.length + report.inspection.length + report.predictive.length})
                    <HelpTip title="Seccion 1" text="Intervenciones preventivas y de inspeccion programadas del mes (lista del informe original)." />
                  </h2>
                </div>
                <ReportTable rows={eventRows([...report.preventive, ...report.inspection, ...report.predictive])} />
              </div>

              <div className="mb-6 rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--graphite-800)" }}>
                  <h2 className="text-sm font-bold" style={{ color: "var(--graphite-100)" }}>
                    Seccion 2 - Correctivos ({report.corrective.length})
                    <HelpTip title="Seccion 2" text="Fallas imprevistas del mes con su observacion o pendiente (lista del informe original)." />
                  </h2>
                </div>
                <ReportTable rows={eventRows(report.corrective)} />
              </div>

              <div className="mb-6 rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--graphite-800)" }}>
                  <h2 className="text-sm font-bold" style={{ color: "var(--graphite-100)" }}>
                    Backlog ({report.backlog.length})
                    <HelpTip title="Backlog" text="Eventos todavia abiertos o cerrados con motivo de bloqueo: unidades que siguen retenidas o con trabajo pendiente." />
                  </h2>
                </div>
                {report.backlog.length === 0 ? (
                  <p className="px-5 py-4 text-sm" style={{ color: "var(--graphite-500)" }}>Sin backlog: todos los eventos estan cerrados y sin bloqueos.</p>
                ) : (
                  <ReportTable
                    rows={report.backlog.map((e) => ({
                      Vehiculo: e.vehicle_id,
                      Estado: EVENT_STATUS_LABELS[e.status || "PENDING"],
                      Sistema: SYSTEM_CATEGORY_LABELS[e.system_category] ?? e.system_category,
                      Motivo: e.block_reason ? BLOCK_REASON_LABELS[e.block_reason] ?? e.block_reason : "Sin bloqueo",
                      Falla: new Date(e.failure_timestamp).toLocaleDateString("es-ES"),
                    }))}
                  />
                )}
              </div>

              <div className="mb-6 rounded-2xl border p-5" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <label className="block text-sm font-bold mb-2" style={{ color: "var(--graphite-100)" }}>
                  Conclusiones
                  <HelpTip title="Conclusiones" text="Parrafo automatico con los numeros del mes. Puedes editarlo antes de exportar; el texto que se ve es el que se exporta en PDF y Excel." />
                </label>
                <textarea
                  value={conclusions}
                  onChange={(e) => setConclusions(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all resize-y"
                  style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-100)" }}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

function ReportTable({ rows }: { rows: Record<string, string>[] }) {
  if (rows.length === 0) {
    return <p className="px-5 py-4 text-sm" style={{ color: "var(--graphite-500)" }}>Sin eventos en esta seccion.</p>;
  }
  const columns = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ backgroundColor: "var(--graphite-800)", color: "var(--graphite-400)" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--graphite-800)" }}>
              {columns.map((c) => (
                <td key={c} className="px-4 py-2.5 align-top" style={{ color: "var(--graphite-300)" }}>
                  {row[c] || "--"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
