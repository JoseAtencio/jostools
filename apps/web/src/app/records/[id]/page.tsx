"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import CloseEventModal from "@/components/CloseEventModal";
import ReopenEventModal from "@/components/ReopenEventModal";
import ExportFormatModal from "@/components/ExportFormatModal";
import HelpTip from "@/components/HelpTip";
import { useAppSelector } from "@/lib/redux/hooks";
import { getEventById, buildEventChanges, saveEventChanges, exportEventsToExcel } from "@/lib/services/maintenanceService";
import { exportEventsToPdf } from "@/lib/services/pdfExportService";
import { calculateIndicators, formatHours } from "@/lib/services/indicatorService";
import { getVehicleById } from "@/lib/services/vehicleService";
import {
  EVENT_TYPE_LABELS,
  ACTION_TYPE_LABELS,
  SYSTEM_CATEGORY_LABELS,
  ROOT_CAUSE_LABELS,
  EVENT_STATUS_LABELS,
  BLOCK_REASON_LABELS,
  BLOCK_REASON_OPTIONS,
  type MaintenanceEvent,
} from "@/types/maintenance";
import type { Vehicle } from "@/types/vehicle";

function formatDateTime(iso: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--" : d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}

function hoursBetween(a: string, b: string): number | null {
  if (!a || !b) return null;
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
  return Number.isNaN(diff) || diff < 0 ? null : Math.round(diff * 10) / 10;
}

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAppSelector((state) => state.auth);

  const [event, setEvent] = useState<MaintenanceEvent | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const load = async () => {
    if (!user?.enterpriseId) return;
    setLoading(true);
    try {
      const ev = await getEventById(id);
      if (!ev || ev.enterpriseId !== user.enterpriseId) {
        setNotFound(true);
      } else {
        setEvent(ev);
        try {
          const v = await getVehicleById(ev.enterpriseId, ev.vehicle_id);
          setVehicle(v);
        } catch {
          setVehicle(null);
        }
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id, user?.enterpriseId]);

  const handleExport = (format: "excel" | "pdf") => {
    if (!event) return;
    if (format === "excel") exportEventsToExcel([event], calculateIndicators([event]));
    else exportEventsToPdf([event], `Evento_${event.vehicle_id}`);
    setExportOpen(false);
  };

  const handleBlockReason = async (value: string) => {
    if (!event) return;
    setBlockSaving(true);
    setBlockError(null);
    try {
      const changes = buildEventChanges(event, { block_reason: value });
      await saveEventChanges(event.id, { block_reason: value }, changes, user?.displayName || "Usuario");
      setEvent({ ...event, block_reason: value });
      getEventById(id)
        .then((ev) => { if (ev && ev.enterpriseId === user?.enterpriseId) setEvent(ev); })
        .catch(() => {});
    } catch {
      setBlockError("No se pudo guardar el motivo de bloqueo");
    } finally {
      setBlockSaving(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen" style={{ backgroundColor: "var(--graphite-950)" }}>
          <Navbar />
          <main className="max-w-5xl mx-auto px-4 py-8">
            <div className="text-center py-20" style={{ color: "var(--graphite-500)" }}>Cargando evento...</div>
          </main>
        </div>
      </AuthGuard>
    );
  }

  if (notFound || !event) {
    return (
      <AuthGuard>
        <div className="min-h-screen" style={{ backgroundColor: "var(--graphite-950)" }}>
          <Navbar />
          <main className="max-w-5xl mx-auto px-4 py-8">
            <div className="text-center py-20">
              <p className="text-lg mb-4" style={{ color: "var(--graphite-300)" }}>Evento no encontrado</p>
              <button onClick={() => router.push("/records")} className="px-5 py-2.5 rounded-xl font-medium text-sm cursor-pointer" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>
                Volver a registros
              </button>
            </div>
          </main>
        </div>
      </AuthGuard>
    );
  }

  const isOpen = !event.status || event.status === "PENDING";
  const stayHours = hoursBetween(event.workshop_entry_time, event.workshop_exit_time);

  const items: { label: string; value: string; help?: string }[] = [
    { label: "Vehiculo", value: vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year || ""}`.trim() : event.vehicle_id, help: vehicle ? "Datos del catalogo de vehiculos." : "Este vehiculo no esta en el catalogo; se muestra solo la matricula." },
    { label: "Odometro / Horas", value: event.current_odometer != null ? event.current_odometer.toLocaleString("es-ES") : "--" },
    { label: "Tipo de evento", value: EVENT_TYPE_LABELS[event.event_type] ?? event.event_type },
    { label: "Estado", value: EVENT_STATUS_LABELS[event.status || "PENDING"] },
    { label: "Fecha/Hora Falla", value: formatDateTime(event.failure_timestamp) },
    { label: "Entrada Taller", value: formatDateTime(event.workshop_entry_time) },
    { label: "Salida Taller", value: event.workshop_exit_time ? formatDateTime(event.workshop_exit_time) : "Pendiente de cierre", help: isOpen ? "El evento sigue abierto: la salida se registra al cerrarlo." : "Fecha en que el vehiculo salio del taller." },
    { label: "Duracion en taller", value: stayHours != null ? formatHours(stayHours) : "--", help: "Tiempo entre la entrada y la salida del taller." },
    { label: "Sistema afectado", value: SYSTEM_CATEGORY_LABELS[event.system_category] ?? event.system_category },
    { label: "Componente", value: event.component_id || "--" },
    { label: "Accion realizada", value: ACTION_TYPE_LABELS[event.action_taken] ?? event.action_taken },
    { label: "Causa raiz", value: event.root_cause ? ROOT_CAUSE_LABELS[event.root_cause] : "--" },
    { label: "Horas efectivas", value: event.effective_work_hours != null ? `${event.effective_work_hours} h` : isOpen ? "Se determina al cierre" : "--", help: isOpen ? "Las horas se registran al cerrar el evento." : "Horas reales de trabajo del tecnico." },
    { label: "Costo reparacion", value: `$${event.repair_cost.toLocaleString("es-ES")}` },
    { label: "Observacion", value: event.observation?.trim() ? event.observation : "--" },
    ...(event.block_reason ? [{ label: "Motivo de bloqueo", value: BLOCK_REASON_LABELS[event.block_reason] ?? event.block_reason }] : []),
    { label: "Creado", value: formatDateTime(event.created_at) },
    ...(event.edited_at ? [{ label: "Ultima edicion", value: formatDateTime(event.edited_at), help: `Editado por ${event.edited_by || "Usuario"}. El detalle completo de los cambios esta en el historial.` }] : []),
  ];

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: "var(--graphite-950)" }}>
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <button
              onClick={() => router.push("/records")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all"
              style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-700)", color: "var(--graphite-300)" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Volver
            </button>
            <h1 className="text-2xl font-bold" style={{ color: "var(--graphite-100)" }}>
              Evento {event.vehicle_id}
              <HelpTip title="Detalle del evento" text="Informacion completa del evento de mantenimiento. Si esta abierto puedes editarlo o cerrarlo; si esta cerrado puedes reabrirlo. Toda modificacion queda registrada en el historial de ediciones." />
            </h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{
              backgroundColor: isOpen ? "rgba(247, 183, 8, 0.15)" : "rgba(102, 153, 145, 0.15)",
              color: isOpen ? "var(--tuscan-sun-400)" : "var(--ash-grey-400)",
            }}>
              {EVENT_STATUS_LABELS[event.status || "PENDING"]}
            </span>
            {event.edited_at && (
              <span
                className="px-2.5 py-1 rounded-full text-xs font-medium cursor-help"
                style={{ backgroundColor: "rgba(0, 81, 255, 0.15)", color: "var(--crayola-blue-400)" }}
                title={`Ultima edicion: ${formatDateTime(event.edited_at)} por ${event.edited_by || "Usuario"}`}
              >
                Editado
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap mb-6">
            {isOpen && (
              <>
                <button
                  onClick={() => router.push(`/records/${event.id}/editar`)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all"
                  style={{ backgroundColor: "rgba(0, 81, 255, 0.15)", color: "var(--crayola-blue-400)", border: "1px solid rgba(0, 81, 255, 0.3)" }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Editar
                </button>
                <button
                  onClick={() => setCloseOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all"
                  style={{ backgroundColor: "rgba(102, 153, 145, 0.15)", color: "var(--ash-grey-400)", border: "1px solid rgba(102, 153, 145, 0.3)" }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Cerrar Evento
                </button>
              </>
            )}
            {!isOpen && (
              <button
                onClick={() => setReopenOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all"
                style={{ backgroundColor: "rgba(224, 31, 95, 0.15)", color: "var(--raspberry-red-400)", border: "1px solid rgba(224, 31, 95, 0.3)" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Reabrir
              </button>
            )}
            <button
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all"
              style={{ backgroundColor: "rgba(247, 183, 8, 0.15)", color: "var(--tuscan-sun-400)", border: "1px solid rgba(247, 183, 8, 0.3)" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Exportar
            </button>
          </div>

          {isOpen && (
            <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-800)" }}>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>
                Motivo de bloqueo
                <HelpTip title="Motivo de bloqueo" text="Marca si el evento esta detenido (falta repuesto, falta de pago, sin disponibilidad). Los eventos bloqueados cuentan en el backlog del Informe Mensual. Se guarda automaticamente." />
              </label>
              <select
                value={event.block_reason || ""}
                onChange={(e) => { handleBlockReason(e.target.value); }}
                disabled={blockSaving}
                className="px-4 py-2.5 rounded-xl text-sm outline-none cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-100)" }}
              >
                {BLOCK_REASON_OPTIONS.map((o) => (
                  <option key={o.name} value={o.name}>{o.label}</option>
                ))}
              </select>
              {blockError && (
                <p className="text-xs mt-1.5" style={{ color: "var(--raspberry-red-400)" }}>{blockError}</p>
              )}
            </div>
          )}

          <div className="rounded-2xl border" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ backgroundColor: "var(--graphite-800)" }}>
              {items.map((item) => (
                <div key={item.label} className="p-5" style={{ backgroundColor: "var(--graphite-900)" }}>
                  <p className="text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--graphite-500)" }}>
                    {item.label}
                    {item.help && <HelpTip text={item.help} />}
                  </p>
                  <p className="text-sm font-medium" style={{ color: "var(--graphite-100)" }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {event.edit_history && event.edit_history.length > 0 && (
            <div className="rounded-2xl border p-6 mt-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <h2 className="text-base font-bold" style={{ color: "var(--graphite-100)" }}>
                  Historial de ediciones
                  <HelpTip title="Historial de ediciones" text="Cada vez que se modifica el evento (editar campos o reabrirlo) se registra la fecha, el usuario y cada campo cambiado con su valor anterior y el nuevo." />
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "rgba(0, 81, 255, 0.15)", color: "var(--crayola-blue-400)" }}>
                  {event.edit_history.length} {event.edit_history.length === 1 ? "edicion" : "ediciones"}
                </span>
              </div>
              <div className="space-y-4">
                {[...event.edit_history].reverse().map((entry, i) => (
                  <div key={i} className={i > 0 ? "pt-4" : ""} style={i > 0 ? { borderTop: "1px solid var(--graphite-800)" } : undefined}>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--tuscan-sun-400)" }}>
                      {formatDateTime(entry.at)} — <span style={{ color: "var(--graphite-300)" }}>{entry.by}</span>
                    </p>
                    <ul className="space-y-1.5">
                      {entry.changes.map((c, j) => (
                        <li key={j} className="text-xs flex items-start gap-2 flex-wrap" style={{ color: "var(--graphite-400)" }}>
                          <span className="font-semibold" style={{ color: "var(--graphite-200)" }}>{c.label}:</span>
                          <span style={{ color: "var(--raspberry-red-400)" }}>{c.from}</span>
                          <span style={{ color: "var(--graphite-600)" }}>&rarr;</span>
                          <span style={{ color: "var(--ash-grey-400)" }}>{c.to}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {closeOpen && (
        <CloseEventModal event={event} onSuccess={() => { setCloseOpen(false); load(); }} onCancel={() => setCloseOpen(false)} />
      )}
      {reopenOpen && (
        <ReopenEventModal event={event} onSuccess={() => { setReopenOpen(false); load(); }} onCancel={() => setReopenOpen(false)} />
      )}
      {exportOpen && (
        <ExportFormatModal count={1} titulo="evento" onCancel={() => setExportOpen(false)} onExport={handleExport} />
      )}
    </AuthGuard>
  );
}
