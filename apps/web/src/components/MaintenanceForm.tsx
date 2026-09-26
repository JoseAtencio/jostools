"use client";

import { useState, useEffect } from "react";
import { useAppSelector } from "@/lib/redux/hooks";
import { createMaintenanceEvent } from "@/lib/services/maintenanceService";
import { getCategoriesByGroup } from "@/lib/services/categoryService";
import { useRouter } from "next/navigation";
import SearchableSelect from "@/components/SearchableSelect";
import type { EventType, ActionType, SystemCategory, RootCause, MaintenanceEventInput } from "@/types/maintenance";
import type { Category, CategoryGroup } from "@/types/categories";

const inputStyle = {
  backgroundColor: "var(--graphite-800)",
  border: "1px solid var(--graphite-600)",
  color: "var(--graphite-100)",
};

export default function MaintenanceForm() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [categories, setCategories] = useState<Record<CategoryGroup, Category[]>>({
    event_type: [],
    system_category: [],
    component: [],
    action_taken: [],
    root_cause: [],
  });

  const [formData, setFormData] = useState({
    vehicle_id: "",
    current_odometer: "",
    event_type: "",
    failure_timestamp: "",
    workshop_entry_time: "",
    workshop_exit_time: "",
    effective_work_hours: "",
    system_category: "",
    component_id: "",
    action_taken: "",
    root_cause: "",
    repair_cost: "",
  });

  useEffect(() => {
    const loadCategories = async () => {
      const groups: CategoryGroup[] = ["event_type", "system_category", "component", "action_taken", "root_cause"];
      const loaded: Record<string, Category[]> = {};
      for (const group of groups) {
        loaded[group] = await getCategoriesByGroup(group);
      }
      setCategories(loaded as Record<CategoryGroup, Category[]>);
    };
    loadCategories();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.vehicle_id || !formData.event_type || !formData.system_category || !formData.action_taken) {
      setError("Todos los campos requeridos deben ser completados");
      return;
    }

    if (new Date(formData.workshop_exit_time) < new Date(formData.workshop_entry_time)) {
      setError("La fecha de salida no puede ser anterior a la de entrada");
      return;
    }

    if (new Date(formData.workshop_entry_time) < new Date(formData.failure_timestamp)) {
      setError("La fecha de entrada no puede ser anterior a la fecha de falla");
      return;
    }

    setLoading(true);
    try {
      const event: MaintenanceEventInput = {
        vehicle_id: formData.vehicle_id,
        current_odometer: parseFloat(formData.current_odometer) || 0,
        event_type: formData.event_type as EventType,
        failure_timestamp: formData.failure_timestamp,
        workshop_entry_time: formData.workshop_entry_time,
        workshop_exit_time: formData.workshop_exit_time,
        effective_work_hours: formData.effective_work_hours ? parseFloat(formData.effective_work_hours) : null,
        system_category: formData.system_category as SystemCategory,
        component_id: formData.component_id,
        action_taken: formData.action_taken as ActionType,
        root_cause: formData.root_cause ? (formData.root_cause as RootCause) : null,
        repair_cost: parseFloat(formData.repair_cost) || 0,
        user_id: user?.uid || "",
        enterpriseId: user?.enterpriseId || "",
      };

      await createMaintenanceEvent(event);
      setSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el evento");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border p-10 text-center" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(102, 153, 145, 0.15)" }}>
          <svg className="w-8 h-8" style={{ color: "var(--ash-grey-400)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--graphite-50)" }}>Evento registrado</h2>
        <p style={{ color: "var(--graphite-400)" }}>Redirigiendo al dashboard...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border p-8" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
      <h2 className="text-xl font-semibold mb-6" style={{ color: "var(--graphite-50)" }}>Nuevo Evento de Mantenimiento</h2>

      {error && (
        <div className="mb-6 p-4 rounded-xl text-sm" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
          {error}
        </div>
      )}

      {/* Vehiculo y Odometro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>ID Vehiculo (Placa/VIN) *</label>
          <input
            type="text"
            name="vehicle_id"
            value={formData.vehicle_id}
            onChange={handleChange}
            placeholder="Ej: ABC-123"
            required
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>Odometro / Horas *</label>
          <input
            type="number"
            name="current_odometer"
            value={formData.current_odometer}
            onChange={handleChange}
            placeholder="Kilometraje o horas motor"
            required
            step="0.01"
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Tipo de Evento */}
      <div className="mb-6">
        <SearchableSelect
          label="Tipo de Evento"
          value={formData.event_type}
          options={categories.event_type.map((c) => ({ name: c.name, label: c.label }))}
          onChange={(v) => handleSelectChange("event_type", v)}
          placeholder="Seleccionar tipo de evento..."
          required
        />
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>Fecha/Hora Falla *</label>
          <input
            type="datetime-local"
            name="failure_timestamp"
            value={formData.failure_timestamp}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>Entrada Taller *</label>
          <input
            type="datetime-local"
            name="workshop_entry_time"
            value={formData.workshop_entry_time}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>Salida Taller *</label>
          <input
            type="datetime-local"
            name="workshop_exit_time"
            value={formData.workshop_exit_time}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Sistema y Componente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <SearchableSelect
          label="Sistema Afectado"
          value={formData.system_category}
          options={categories.system_category.map((c) => ({ name: c.name, label: c.label }))}
          onChange={(v) => handleSelectChange("system_category", v)}
          placeholder="Seleccionar sistema..."
          required
        />
        <SearchableSelect
          label="Componente"
          value={formData.component_id}
          options={categories.component.map((c) => ({ name: c.name, label: c.label }))}
          onChange={(v) => handleSelectChange("component_id", v)}
          placeholder="Seleccionar componente..."
          required
        />
      </div>

      {/* Accion y Causa */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <SearchableSelect
          label="Accion Realizada"
          value={formData.action_taken}
          options={categories.action_taken.map((c) => ({ name: c.name, label: c.label }))}
          onChange={(v) => handleSelectChange("action_taken", v)}
          placeholder="Seleccionar accion..."
          required
        />
        <SearchableSelect
          label="Causa Raiz"
          value={formData.root_cause}
          options={categories.root_cause.map((c) => ({ name: c.name, label: c.label }))}
          onChange={(v) => handleSelectChange("root_cause", v)}
          placeholder="Seleccionar causa..."
        />
      </div>

      {/* Horas y Costo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>Horas Hombre Efectivas</label>
          <input
            type="number"
            name="effective_work_hours"
            value={formData.effective_work_hours}
            onChange={handleChange}
            placeholder="Horas reales de trabajo"
            step="0.01"
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>Costo Total Reparacion</label>
          <input
            type="number"
            name="repair_cost"
            value={formData.repair_cost}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3 px-6 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          style={{
            backgroundColor: "var(--tuscan-sun-500)",
            color: "var(--graphite-950)",
          }}
        >
          {loading ? "Guardando..." : "Registrar Evento"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="px-6 py-3 rounded-xl font-medium transition-all cursor-pointer"
          style={{
            backgroundColor: "var(--graphite-800)",
            border: "1px solid var(--graphite-600)",
            color: "var(--graphite-300)",
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
