"use client";

import { useState } from "react";
import { reopenMaintenanceEvent } from "@/lib/services/maintenanceService";
import { useAppSelector } from "@/lib/redux/hooks";
import type { MaintenanceEvent } from "@/types/maintenance";

interface ReopenEventModalProps {
  event: MaintenanceEvent;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ReopenEventModal({ event, onSuccess, onCancel }: ReopenEventModalProps) {
  const { user } = useAppSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReopen = async () => {
    setLoading(true);
    setError(null);
    try {
      await reopenMaintenanceEvent(event, user?.displayName || "Usuario");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reabrir el evento");
      setLoading(false);
    }
  };

  const bullets = [
    "El evento vuelve a estado Abierto (el vehiculo se considera en taller).",
    "Se limpian la fecha de salida, las horas efectivas y el costo de reparacion; los valores anteriores quedan guardados en el historial de cambios.",
    "Los indicadores (MTTR, MTTF y disponibilidad) se recalculan automaticamente.",
    "Despues de reabrir podras editar el evento y volver a cerrarlo con sus datos finales.",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onCancel}>
      <div className="rounded-2xl border w-full max-w-lg p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: "var(--graphite-100)" }}>Reabrir evento</h2>
          <button onClick={onCancel} className="p-1 rounded-lg cursor-pointer" style={{ color: "var(--graphite-500)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--graphite-200)"; e.currentTarget.style.backgroundColor = "var(--graphite-800)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--graphite-500)"; e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="mb-4 p-3 rounded-xl text-xs space-y-1" style={{ backgroundColor: "var(--graphite-800)" }}>
          <div style={{ color: "var(--graphite-400)" }}><span style={{ color: "var(--graphite-200)" }}>Vehiculo:</span> {event.vehicle_id}</div>
          <div style={{ color: "var(--graphite-400)" }}><span style={{ color: "var(--graphite-200)" }}>Estado actual:</span> Cerrado</div>
          {event.workshop_exit_time && (
            <div style={{ color: "var(--graphite-400)" }}><span style={{ color: "var(--graphite-200)" }}>Se limpiara:</span> salida, horas ({event.effective_work_hours ?? "--"} h) y costo (${event.repair_cost.toLocaleString("es-ES")})</div>
          )}
        </div>

        <ul className="mb-4 space-y-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--graphite-400)" }}>
              <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5" style={{ backgroundColor: "var(--raspberry-red-500)", color: "#fff" }}>{i + 1}</span>
              {b}
            </li>
          ))}
        </ul>

        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleReopen}
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: "var(--raspberry-red-500)", color: "#fff" }}
          >
            {loading ? "Reabriendo..." : "Reabrir evento"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl font-medium text-sm cursor-pointer"
            style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-300)" }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
