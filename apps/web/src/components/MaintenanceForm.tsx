"use client";

import { useState, useEffect, useRef } from "react";
import { useAppSelector } from "@/lib/redux/hooks";
import { createMaintenanceEvent } from "@/lib/services/maintenanceService";
import { getCategoriesByGroup } from "@/lib/services/categoryService";
import { normalizeVehicleId } from "@/lib/services/vehicleService";
import { collection, getDocs, limit, query, where } from "@firebase/firestore";
import { db } from "@jostools/firebase-config";
import { useRouter } from "next/navigation";
import SearchableSelect from "@/components/SearchableSelect";
import VehicleCombobox from "@/components/VehicleCombobox";
import type { EventType, ActionType, SystemCategory, RootCause, MaintenanceEventInput } from "@/types/maintenance";
import type { Category, CategoryGroup } from "@/types/categories";

const inputStyle = {
  backgroundColor: "var(--graphite-800)",
  border: "1px solid var(--graphite-600)",
  color: "var(--graphite-100)",
};

const dependentClears: Record<string, string[]> = {
  failure_timestamp: ["workshop_entry_time"],
  workshop_entry_time: ["failure_timestamp", "workshop_exit_time"],
  workshop_exit_time: ["workshop_entry_time"],
};

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createInitialFormData() {
  const now = toLocalDatetimeValue(new Date());
  return {
    vehicle_id: "",
    current_odometer: "",
    event_type: "",
    failure_timestamp: now,
    workshop_entry_time: now,
    workshop_exit_time: "",
    effective_work_hours: "",
    system_category: "",
    component_id: "",
    action_taken: "",
    root_cause: "",
    repair_cost: "",
  };
}

function toMillis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  const time = new Date(String(value ?? "")).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export default function MaintenanceForm() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const vehicleInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [catsLoading, setCatsLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);

  const [categories, setCategories] = useState<Record<CategoryGroup, Category[]>>({
    event_type: [],
    system_category: [],
    component: [],
    action_taken: [],
    root_cause: [],
  });

  const [initialFormData] = useState(createInitialFormData);
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    const groups: CategoryGroup[] = ["event_type", "system_category", "component", "action_taken", "root_cause"];
    (async () => {
      try {
        const results = await Promise.all(groups.map((group) => getCategoriesByGroup(group)));
        const loaded = {} as Record<CategoryGroup, Category[]>;
        groups.forEach((group, index) => {
          loaded[group] = results[index];
        });
        setCategories(loaded);
      } catch (err) {
        console.error("Error cargando categorias:", err);
      } finally {
        setCatsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const enterpriseId = user?.enterpriseId;
    if (!enterpriseId) return;
    let cancelled = false;
    (async () => {
      try {
        const eventsQuery = query(
          collection(db, "jostools", "config", "maintenance_events"),
          where("enterpriseId", "==", enterpriseId),
          limit(50)
        );
        const snapshot = await getDocs(eventsQuery);
        if (cancelled || snapshot.empty) return;
        const events = snapshot.docs.map((docSnap) => docSnap.data() as {
          vehicle_id?: string;
          current_odometer?: number | string | null;
          created_at?: unknown;
        });
        events.sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at));
        const lastVehicleId = events[0].vehicle_id;
        if (!lastVehicleId) return;
        const lastOfVehicle = events.find((event) => event.vehicle_id === lastVehicleId);
        const odometer = lastOfVehicle?.current_odometer;
        setFormData((prev) => {
          const fillVehicle = !prev.vehicle_id.trim();
          const fillOdometer = !prev.current_odometer.trim() && odometer !== undefined && odometer !== null && String(odometer) !== "";
          if (!fillVehicle && !fillOdometer) return prev;
          const next = { ...prev };
          if (fillVehicle) next.vehicle_id = lastVehicleId;
          if (fillOdometer) next.current_odometer = String(odometer);
          return next;
        });
      } catch (err) {
        if (!cancelled) console.error("Error cargando ultimo vehiculo:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.enterpriseId]);

  useEffect(() => {
    if (focusRequest > 0) vehicleInputRef.current?.focus();
  }, [focusRequest]);

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      const keys = [field, ...(dependentClears[field] ?? [])];
      if (!keys.some((key) => prev[key])) return prev;
      const next = { ...prev };
      keys.forEach((key) => delete next[key]);
      return next;
    });
  };

  const updateField = (name: string, value: string) => {
    const next = { ...formData, [name]: value };
    setFormData(next);
    setDirty(JSON.stringify(next) !== JSON.stringify(initialFormData));
    clearFieldError(name);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateField(e.target.name, e.target.value);
  };

  const handleSelectChange = (name: string, value: string) => {
    updateField(name, value);
  };

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!normalizeVehicleId(formData.vehicle_id)) errors.vehicle_id = "La matricula es requerida";
    if (!formData.event_type) errors.event_type = "El tipo de evento es requerido";
    if (!formData.system_category) errors.system_category = "El sistema afectado es requerido";
    if (!formData.component_id) errors.component_id = "El componente es requerido";
    if (!formData.action_taken) errors.action_taken = "La accion realizada es requerida";
    if (!formData.failure_timestamp) errors.failure_timestamp = "La fecha de falla es requerida";
    if (!formData.workshop_entry_time) errors.workshop_entry_time = "La fecha de entrada es requerida";
    if (
      formData.workshop_entry_time &&
      formData.failure_timestamp &&
      new Date(formData.workshop_entry_time) < new Date(formData.failure_timestamp)
    ) {
      errors.workshop_entry_time = "La fecha de entrada no puede ser anterior a la fecha de falla";
    }
    if (
      formData.workshop_exit_time &&
      formData.workshop_entry_time &&
      new Date(formData.workshop_exit_time) < new Date(formData.workshop_entry_time)
    ) {
      errors.workshop_exit_time = "La fecha de salida no puede ser anterior a la de entrada";
    }
    if (!formData.current_odometer.trim()) errors.current_odometer = "El odometro es requerido";
    else if (parseFloat(formData.current_odometer) < 0) errors.current_odometer = "El odometro no puede ser negativo";
    if (formData.effective_work_hours && parseFloat(formData.effective_work_hours) < 0) errors.effective_work_hours = "Las horas no pueden ser negativas";
    if (formData.repair_cost && parseFloat(formData.repair_cost) < 0) errors.repair_cost = "El costo no puede ser negativo";
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const normalizedVehicleId = normalizeVehicleId(formData.vehicle_id);
    if (normalizedVehicleId !== formData.vehicle_id) {
      setFormData((prev) => ({ ...prev, vehicle_id: normalizedVehicleId }));
    }

    setLoading(true);
    try {
      const event: MaintenanceEventInput = {
        vehicle_id: normalizedVehicleId,
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

      const id = await createMaintenanceEvent(event);
      setSavedId(id);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el evento");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterAnother = () => {
    setFormData(createInitialFormData());
    setFieldErrors({});
    setError(null);
    setSavedId(null);
    setDirty(false);
    setFocusRequest((n) => n + 1);
  };

  const handleCancel = () => {
    if (dirty && !window.confirm("Tienes datos sin guardar. ¿Salir?")) return;
    router.push("/");
  };

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const bannerMessage = error ?? (hasFieldErrors ? "Revisa los campos marcados" : null);

  const errorStyle = (field: string) =>
    fieldErrors[field] ? { ...inputStyle, borderColor: "var(--raspberry-red-400)" } : inputStyle;

  const fieldError = (field: string) =>
    fieldErrors[field] ? (
      <p className="mt-1 text-[11px]" style={{ color: "var(--raspberry-red-400)" }}>{fieldErrors[field]}</p>
    ) : null;

  if (savedId) {
    return (
      <div className="rounded-2xl border p-10 text-center" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(102, 153, 145, 0.15)" }}>
          <svg className="w-8 h-8" style={{ color: "var(--ash-grey-400)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--graphite-50)" }}>Evento registrado</h2>
        <p className="mb-6" style={{ color: "var(--graphite-400)" }}>El evento se guardo correctamente</p>
        <div className="flex gap-4 justify-center">
          <button
            type="button"
            onClick={handleRegisterAnother}
            className="py-3 px-6 rounded-xl font-medium transition-all cursor-pointer"
            style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}
          >
            Registrar otro evento
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="py-3 px-6 rounded-xl font-medium transition-all cursor-pointer"
            style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-300)" }}
          >
            Ir al dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border p-8" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
      <h2 className="text-xl font-semibold mb-6" style={{ color: "var(--graphite-50)" }}>Nuevo Evento de Mantenimiento</h2>

      {bannerMessage && (
        <div className="mb-6 p-4 rounded-xl text-sm" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
          {bannerMessage}
        </div>
      )}

      {catsLoading && (
        <div className="flex items-center gap-2 mb-5">
          <svg className="w-4 h-4 animate-spin" style={{ color: "var(--tuscan-sun-400)" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-xs" style={{ color: "var(--graphite-500)" }}>Cargando categorias...</p>
        </div>
      )}

      {/* Vehiculo y Odometro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>ID Vehiculo (Placa/VIN) *</label>
          <VehicleCombobox
            value={formData.vehicle_id}
            onChange={(v) => handleSelectChange("vehicle_id", v)}
            enterpriseId={user?.enterpriseId ?? null}
            placeholder="Ej: ABC-123"
            inputRef={vehicleInputRef}
            name="vehicle_id"
          />
          {fieldError("vehicle_id")}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>Odometro / Horas *</label>
          <input
            type="number"
            name="current_odometer"
            value={formData.current_odometer}
            onChange={handleChange}
            placeholder="Kilometraje o horas motor"
            step="any"
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
            style={errorStyle("current_odometer")}
          />
          {fieldError("current_odometer")}
        </div>
      </div>

      {/* Tipo de Evento */}
      <div className="mb-6">
        <SearchableSelect
          label="Tipo de Evento"
          value={formData.event_type}
          options={categories.event_type.map((c) => ({ name: c.name, label: c.label }))}
          onChange={(v) => handleSelectChange("event_type", v)}
          placeholder={catsLoading ? "Cargando..." : "Seleccionar tipo de evento..."}
          required
          disabled={catsLoading}
        />
        {fieldError("event_type")}
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
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
            style={errorStyle("failure_timestamp")}
          />
          {fieldError("failure_timestamp")}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>Entrada Taller *</label>
          <input
            type="datetime-local"
            name="workshop_entry_time"
            value={formData.workshop_entry_time}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
            style={errorStyle("workshop_entry_time")}
          />
          {fieldError("workshop_entry_time")}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>Salida Taller</label>
          <input
            type="datetime-local"
            name="workshop_exit_time"
            value={formData.workshop_exit_time}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
            style={errorStyle("workshop_exit_time")}
          />
          {fieldError("workshop_exit_time")}
        </div>
      </div>

      {/* Sistema y Componente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div>
          <SearchableSelect
            label="Sistema Afectado"
            value={formData.system_category}
            options={categories.system_category.map((c) => ({ name: c.name, label: c.label }))}
            onChange={(v) => handleSelectChange("system_category", v)}
            placeholder={catsLoading ? "Cargando..." : "Seleccionar sistema..."}
            required
            disabled={catsLoading}
          />
          {fieldError("system_category")}
        </div>
        <div>
          <SearchableSelect
            label="Componente"
            value={formData.component_id}
            options={categories.component.map((c) => ({ name: c.name, label: c.label }))}
            onChange={(v) => handleSelectChange("component_id", v)}
            placeholder={catsLoading ? "Cargando..." : "Seleccionar componente..."}
            required
            disabled={catsLoading}
          />
          {fieldError("component_id")}
        </div>
      </div>

      {/* Accion y Causa */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div>
          <SearchableSelect
            label="Accion Realizada"
            value={formData.action_taken}
            options={categories.action_taken.map((c) => ({ name: c.name, label: c.label }))}
            onChange={(v) => handleSelectChange("action_taken", v)}
            placeholder={catsLoading ? "Cargando..." : "Seleccionar accion..."}
            required
            disabled={catsLoading}
          />
          {fieldError("action_taken")}
        </div>
        <div>
          <SearchableSelect
            label="Causa Raiz"
            value={formData.root_cause}
            options={categories.root_cause.map((c) => ({ name: c.name, label: c.label }))}
            onChange={(v) => handleSelectChange("root_cause", v)}
            placeholder={catsLoading ? "Cargando..." : "Seleccionar causa..."}
            disabled={catsLoading}
          />
          {fieldError("root_cause")}
        </div>
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
            step="any"
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
            style={errorStyle("effective_work_hours")}
          />
          {fieldError("effective_work_hours")}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>Costo Total Reparacion</label>
          <input
            type="number"
            name="repair_cost"
            value={formData.repair_cost}
            onChange={handleChange}
            placeholder="0.00"
            step="any"
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
            style={errorStyle("repair_cost")}
          />
          {fieldError("repair_cost")}
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
          onClick={handleCancel}
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
