"use client";

import { useState, useEffect } from "react";
import { useAppSelector } from "@/lib/redux/hooks";
import { createMaintenanceEvent } from "@/lib/services/maintenanceService";
import { getCategoriesByGroup, addCategory } from "@/lib/services/categoryService";
import SearchableSelect from "@/components/SearchableSelect";
import type { EventType, SystemCategory, MaintenanceEventInput } from "@/types/maintenance";
import type { Category, CategoryGroup } from "@/types/categories";

const inputStyle = {
  backgroundColor: "var(--graphite-800)",
  border: "1px solid var(--graphite-600)",
  color: "var(--graphite-100)",
};

interface QuickOpenFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function QuickOpenForm({ onSuccess, onCancel }: QuickOpenFormProps) {
  const { user } = useAppSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventTypes, setEventTypes] = useState<Category[]>([]);
  const [systemCategories, setSystemCategories] = useState<Category[]>([]);

  const [formData, setFormData] = useState({
    vehicle_id: "",
    event_type: "",
    failure_timestamp: "",
    workshop_entry_time: "",
    system_category: "",
  });

  useEffect(() => {
    getCategoriesByGroup("event_type").then(setEventTypes);
    getCategoriesByGroup("system_category").then(setSystemCategories);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleCreateCategory = async (group: CategoryGroup, label: string) => {
    const name = label.toUpperCase().replace(/\s+/g, "_");
    await addCategory({
      group,
      name,
      label,
      active: true,
    });
    if (group === "event_type") {
      const updated = await getCategoriesByGroup("event_type");
      setEventTypes(updated);
      setFormData((prev) => ({ ...prev, event_type: name }));
    } else if (group === "system_category") {
      const updated = await getCategoriesByGroup("system_category");
      setSystemCategories(updated);
      setFormData((prev) => ({ ...prev, system_category: name }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.vehicle_id || !formData.event_type || !formData.failure_timestamp || !formData.workshop_entry_time || !formData.system_category) {
      setError("Todos los campos son requeridos");
      return;
    }

    setLoading(true);
    try {
      const event: MaintenanceEventInput = {
        vehicle_id: formData.vehicle_id,
        current_odometer: 0,
        event_type: formData.event_type as EventType,
        failure_timestamp: formData.failure_timestamp,
        workshop_entry_time: formData.workshop_entry_time,
        workshop_exit_time: "",
        effective_work_hours: null,
        system_category: formData.system_category as SystemCategory,
        component_id: "",
        action_taken: "REPAIRED",
        root_cause: null,
        repair_cost: 0,
        user_id: user?.uid || "",
        status: "PENDING",
        enterpriseId: user?.enterpriseId || "",
      };

      await createMaintenanceEvent(event);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onCancel}>
      <div className="rounded-2xl border w-full max-w-lg p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold" style={{ color: "var(--graphite-100)" }}>Abrir Evento de Mantenimiento</h2>
          <button onClick={onCancel} className="p-1 rounded-lg cursor-pointer" style={{ color: "var(--graphite-500)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--graphite-200)"; e.currentTarget.style.backgroundColor = "var(--graphite-800)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--graphite-500)"; e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Vehiculo *</label>
            <input type="text" name="vehicle_id" value={formData.vehicle_id} onChange={handleChange} placeholder="Placa o VIN" required className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SearchableSelect
              label="Tipo de Evento"
              value={formData.event_type}
              options={eventTypes.map((c) => ({ name: c.name, label: c.label }))}
              onChange={(v) => handleSelectChange("event_type", v)}
              placeholder="Seleccionar tipo..."
              required
              onCreateNew={(search) => handleCreateCategory("event_type", search)}
            />
            <SearchableSelect
              label="Categoria"
              value={formData.system_category}
              options={systemCategories.map((c) => ({ name: c.name, label: c.label }))}
              onChange={(v) => handleSelectChange("system_category", v)}
              placeholder="Seleccionar categoria..."
              required
              onCreateNew={(search) => handleCreateCategory("system_category", search)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Fecha/Hora de Falla *</label>
            <input type="datetime-local" name="failure_timestamp" value={formData.failure_timestamp} onChange={handleChange} required className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Entrada al Taller *</label>
            <input type="datetime-local" name="workshop_entry_time" value={formData.workshop_entry_time} onChange={handleChange} required className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all disabled:opacity-50 cursor-pointer" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>
              {loading ? "Abriendo..." : "Abrir Evento"}
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
