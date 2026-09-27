"use client";

import { useState } from "react";
import { updateMaintenanceEvent } from "@/lib/services/maintenanceService";
import type { MaintenanceEvent, ActionType, RootCause } from "@/types/maintenance";

const inputStyle = {
  backgroundColor: "var(--graphite-800)",
  border: "1px solid var(--graphite-600)",
  color: "var(--graphite-100)",
};

interface CloseEventModalProps {
  event: MaintenanceEvent;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CloseEventModal({ event, onSuccess, onCancel }: CloseEventModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const localNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const [formData, setFormData] = useState({
    workshop_exit_time: localNow,
    action_taken: "REPAIRED" as ActionType,
    root_cause: "" as RootCause | "",
    effective_work_hours: "",
    repair_cost: "",
    component_id: event.component_id || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.workshop_exit_time) {
      setError("La fecha de salida es requerida");
      return;
    }

    if (new Date(formData.workshop_exit_time) < new Date(event.workshop_entry_time)) {
      setError("La salida no puede ser anterior a la entrada");
      return;
    }

    setLoading(true);
    try {
      await updateMaintenanceEvent(event.id, {
        workshop_exit_time: formData.workshop_exit_time,
        action_taken: formData.action_taken,
        root_cause: formData.root_cause || null,
        effective_work_hours: formData.effective_work_hours ? parseFloat(formData.effective_work_hours) : null,
        repair_cost: parseFloat(formData.repair_cost) || 0,
        component_id: formData.component_id,
        status: "COMPLETED",
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cerrar evento");
    } finally {
      setLoading(false);
    }
  };

  const entryDate = new Date(event.workshop_entry_time);
  const failureDate = new Date(event.failure_timestamp);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onCancel}>
      <div className="rounded-2xl border w-full max-w-lg p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: "var(--graphite-100)" }}>Cerrar Evento</h2>
          <button onClick={onCancel} className="p-1 rounded-lg cursor-pointer" style={{ color: "var(--graphite-500)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--graphite-200)"; e.currentTarget.style.backgroundColor = "var(--graphite-800)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--graphite-500)"; e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="mb-4 p-3 rounded-xl text-xs space-y-1" style={{ backgroundColor: "var(--graphite-800)" }}>
          <div style={{ color: "var(--graphite-400)" }}><span style={{ color: "var(--graphite-200)" }}>Vehiculo:</span> {event.vehicle_id}</div>
          <div style={{ color: "var(--graphite-400)" }}><span style={{ color: "var(--graphite-200)" }}>Falla:</span> {failureDate.toLocaleDateString("es-ES")} {failureDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</div>
          <div style={{ color: "var(--graphite-400)" }}><span style={{ color: "var(--graphite-200)" }}>Entrada:</span> {entryDate.toLocaleDateString("es-ES")} {entryDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Salida del Taller *</label>
            <input type="datetime-local" name="workshop_exit_time" value={formData.workshop_exit_time} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Accion *</label>
              <select name="action_taken" value={formData.action_taken} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}>
                <option value="REPAIRED">Reparado</option>
                <option value="REPLACED">Reemplazado</option>
                <option value="ADJUSTED">Ajustado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Causa Raiz</label>
              <select name="root_cause" value={formData.root_cause} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}>
                <option value="">Seleccionar...</option>
                <option value="WEAR_AND_TEAR">Desgaste natural</option>
                <option value="OPERATOR_ERROR">Error del operador</option>
                <option value="PART_DEFECT">Defecto de repuesto</option>
                <option value="ACCIDENT">Accidente</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Horas Efectivas</label>
              <input type="number" name="effective_work_hours" value={formData.effective_work_hours} onChange={handleChange} placeholder="Horas de trabajo" step="any" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Costo Reparacion</label>
              <input type="number" name="repair_cost" value={formData.repair_cost} onChange={handleChange} placeholder="0.00" step="any" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all disabled:opacity-50 cursor-pointer" style={{ backgroundColor: "var(--ash-grey-400)", color: "var(--graphite-950)" }}>
              {loading ? "Cerrando..." : "Cerrar Evento"}
            </button>
            <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl font-medium text-sm cursor-pointer" style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-300)" }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
