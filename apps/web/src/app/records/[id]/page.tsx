"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import CloseEventModal from "@/components/CloseEventModal";
import ExportFormatModal from "@/components/ExportFormatModal";
import HelpTip from "@/components/HelpTip";
import { useAppSelector } from "@/lib/redux/hooks";
import { getEventById, exportEventsToExcel } from "@/lib/services/maintenanceService";
import { exportEventsToPdf } from "@/lib/services/pdfExportService";
import { calculateIndicators, formatHours } from "@/lib/services/indicatorService";
import { getVehicleById } from "@/lib/services/vehicleService";
import {
  EVENT_TYPE_LABELS,
  ACTION_TYPE_LABELS,
  SYSTEM_CATEGORY_LABELS,
  ROOT_CAUSE_LABELS,
  EVENT_STATUS_LABELS,
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
  const [exportOpen, setExportOpen] = useState(false);

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
    { label: "Odometro / Horas", value: event.current_odometer.toLocaleString("es-ES") },
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
    { label: "Creado", value: formatDateTime(event.created_at) },
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
              <HelpTip title="Detalle del evento" text="Informacion completa del evento de mantenimiento. Si el evento esta abierto puedes editarlo o cerrarlo; tambien puedes exportarlo en Excel o PDF." />
            </h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{
              backgroundColor: isOpen ? "rgba(247, 183, 8, 0.15)" : "rgba(102, 153, 145, 0.15)",
              color: isOpen ? "var(--tuscan-sun-400)" : "var(--ash-grey-400)",
            }}>
              {EVENT_STATUS_LABELS[event.status || "PENDING"]}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap mb-6">
            {isOpen && (
              <>
                <button
                  onClick={() => router.push(`/records/${event.id}/editar`)}
                  className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all"
                  style={{ backgroundColor: "rgba(0, 81, 255, 0.15)", color: "var(--crayola-blue-400)", border: "1px solid rgba(0, 81, 255, 0.3)" }}
                >
                  Editar
                </button>
                <button
                  onClick={() => setCloseOpen(true)}
                  className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all"
                  style={{ backgroundColor: "rgba(102, 153, 145, 0.15)", color: "var(--ash-grey-400)", border: "1px solid rgba(102, 153, 145, 0.3)" }}
                >
                  Cerrar Evento
                </button>
              </>
            )}
            <button
              onClick={() => setExportOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all"
              style={{ backgroundColor: "rgba(247, 183, 8, 0.15)", color: "var(--tuscan-sun-400)", border: "1px solid rgba(247, 183, 8, 0.3)" }}
            >
              Exportar
            </button>
          </div>

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
        </main>
      </div>

      {closeOpen && (
        <CloseEventModal event={event} onSuccess={() => { setCloseOpen(false); load(); }} onCancel={() => setCloseOpen(false)} />
      )}
      {exportOpen && (
        <ExportFormatModal count={1} titulo="evento" onCancel={() => setExportOpen(false)} onExport={handleExport} />
      )}
    </AuthGuard>
  );
}
