"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import HelpTip from "@/components/HelpTip";
import SearchableSelect from "@/components/SearchableSelect";
import { useAppSelector } from "@/lib/redux/hooks";
import { getEventById, updateMaintenanceEvent } from "@/lib/services/maintenanceService";
import { getCategoriesByGroup } from "@/lib/services/categoryService";
import { getVehicleById } from "@/lib/services/vehicleService";
import type { EventType, SystemCategory, ActionType, RootCause, MaintenanceEvent } from "@/types/maintenance";
import type { Category, CategoryGroup } from "@/types/categories";
import type { Vehicle } from "@/types/vehicle";

const inputStyle = {
  backgroundColor: "var(--graphite-800)",
  border: "1px solid var(--graphite-600)",
  color: "var(--graphite-100)",
};

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAppSelector((state) => state.auth);

  const [event, setEvent] = useState<MaintenanceEvent | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [closedBlocked, setClosedBlocked] = useState(false);
  const [catsLoading, setCatsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    system_category: "",
    component_id: "",
    action_taken: "",
    root_cause: "",
  });

  useEffect(() => {
    const groups: CategoryGroup[] = ["event_type", "system_category", "component", "action_taken", "root_cause"];
    (async () => {
      try {
        const results = await Promise.all(groups.map((group) => getCategoriesByGroup(group)));
        const loaded = {} as Record<CategoryGroup, Category[]>;
        groups.forEach((group, index) => { loaded[group] = results[index]; });
        setCategories(loaded);
      } catch (err) {
        console.error("Error cargando categorias:", err);
      } finally {
        setCatsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user?.enterpriseId) return;
    (async () => {
      setLoading(true);
      try {
        const ev = await getEventById(id);
        if (!ev || ev.enterpriseId !== user.enterpriseId) {
          setNotFound(true);
        } else {
          setEvent(ev);
          if (ev.status === "COMPLETED") {
            setClosedBlocked(true);
          } else {
            setFormData({
              vehicle_id: ev.vehicle_id,
              current_odometer: String(ev.current_odometer ?? ""),
              event_type: ev.event_type,
              failure_timestamp: toLocalDatetimeValue(new Date(ev.failure_timestamp)),
              workshop_entry_time: toLocalDatetimeValue(new Date(ev.workshop_entry_time)),
              system_category: ev.system_category,
              component_id: ev.component_id,
              action_taken: ev.action_taken,
              root_cause: ev.root_cause || "",
            });
          }
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
    })();
  }, [id, user?.enterpriseId]);

  const updateField = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const selectOptions = (cats: Category[], value: string) => {
    const list = cats.map((c) => ({ name: c.name, label: c.label }));
    if (value && !list.some((o) => o.name === value)) list.unshift({ name: value, label: value });
    return list;
  };

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!formData.current_odometer.trim()) errors.current_odometer = "El odometro es requerido";
    else if (parseFloat(formData.current_odometer) < 0) errors.current_odometer = "El odometro no puede ser negativo";
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
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    try {
      await updateMaintenanceEvent(id, {
        current_odometer: parseFloat(formData.current_odometer),
        event_type: formData.event_type as EventType,
        failure_timestamp: new Date(formData.failure_timestamp).toISOString(),
        workshop_entry_time: new Date(formData.workshop_entry_time).toISOString(),
        system_category: formData.system_category as SystemCategory,
        component_id: formData.component_id,
        action_taken: formData.action_taken as ActionType,
        root_cause: (formData.root_cause || null) as RootCause | null,
      });
      router.push(`/records/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar los cambios");
      setSaving(false);
    }
  };

  const fieldError = (name: string) =>
    fieldErrors[name] ? (
      <p className="text-xs mt-1" style={{ color: "var(--raspberry-red-400)" }}>{fieldErrors[name]}</p>
    ) : null;

  const errorStyle = (name: string) => ({
    ...inputStyle,
    borderColor: fieldErrors[name] ? "var(--raspberry-red-500)" : "var(--graphite-600)",
  });

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen" style={{ backgroundColor: "var(--graphite-950)" }}>
          <Navbar />
          <main className="max-w-3xl mx-auto px-4 py-8">
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
          <main className="max-w-3xl mx-auto px-4 py-8">
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

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: "var(--graphite-950)" }}>
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <button
              onClick={() => router.push(`/records/${id}`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all"
              style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-700)", color: "var(--graphite-300)" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Volver
            </button>
            <h1 className="text-2xl font-bold" style={{ color: "var(--graphite-100)" }}>
              Editar evento {event.vehicle_id}
              <HelpTip title="Editar evento abierto" text="Solo puedes editar eventos abiertos. La matricula del vehiculo no se puede cambiar; las horas efectivas y el costo se determinan al cerrar el evento desde el dashboard." />
            </h1>
          </div>

          {closedBlocked ? (
            <div className="rounded-2xl border p-6 text-center" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
              <p className="text-sm mb-4" style={{ color: "var(--graphite-300)" }}>
                Este evento esta cerrado y no se puede editar. Los eventos cerrados son definitivos.
              </p>
              <button onClick={() => router.push(`/records/${id}`)} className="px-5 py-2.5 rounded-xl font-medium text-sm cursor-pointer" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>
                Ver detalle
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-2xl border p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
              {error && (
                <div className="mb-5 p-3 rounded-xl text-sm" style={{ backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.3)", color: "var(--raspberry-red-400)" }}>
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>
                    Vehiculo
                    <HelpTip title="Vehiculo (no editable)" text="El vehiculo asignado al evento no se puede cambiar. Si necesitas corregirlo, borra el evento y crea uno nuevo." />
                  </label>
                  <input
                    type="text"
                    value={vehicle ? `${vehicle.vehicle_id} — ${vehicle.brand} ${vehicle.model} ${vehicle.year || ""}`.trim() : event.vehicle_id}
                    disabled
                    className="w-full px-4 py-3 rounded-xl text-sm opacity-60 cursor-not-allowed"
                    style={{ ...inputStyle, opacity: 0.6 }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>
                    Odometro / Horas *
                    <HelpTip title="Odometro o horas (obligatorio)" text="Lectura actual del equipo al momento del evento: kilometros para vehiculos o horas motor para maquinaria. Ej: 145000 km o 3200 h." />
                  </label>
                  <input
                    type="number"
                    name="current_odometer"
                    value={formData.current_odometer}
                    onChange={(e) => updateField("current_odometer", e.target.value)}
                    placeholder="Kilometraje o horas motor"
                    step="any"
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                    style={errorStyle("current_odometer")}
                  />
                  {fieldError("current_odometer")}
                </div>
              </div>

              <div className="mb-6">
                <SearchableSelect
                  label="Tipo de Evento"
                  helpText="Clase de intervencion: Preventivo (mantenimiento programado), Correctivo (reparacion de una falla), Predictivo, etc. Obligatorio. Es el principal agrupador de los reportes."
                  value={formData.event_type}
                  options={selectOptions(categories.event_type, formData.event_type)}
                  onChange={(v) => updateField("event_type", v)}
                  placeholder={catsLoading ? "Cargando..." : "Seleccionar tipo de evento..."}
                  required
                  disabled={catsLoading}
                />
                {fieldError("event_type")}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>
                    Fecha/Hora Falla *
                    <HelpTip title="Fecha y hora de la falla" text="Cuando se detecto o ocurrio la falla. No puede ser posterior a la fecha de entrada al taller." />
                  </label>
                  <input
                    type="datetime-local"
                    name="failure_timestamp"
                    value={formData.failure_timestamp}
                    onChange={(e) => updateField("failure_timestamp", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                    style={errorStyle("failure_timestamp")}
                  />
                  {fieldError("failure_timestamp")}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--graphite-300)" }}>
                    Entrada Taller *
                    <HelpTip title="Fecha y hora de entrada" text="Cuando el vehiculo ingreso al taller. No puede ser anterior a la fecha de falla." />
                  </label>
                  <input
                    type="datetime-local"
                    name="workshop_entry_time"
                    value={formData.workshop_entry_time}
                    onChange={(e) => updateField("workshop_entry_time", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                    style={errorStyle("workshop_entry_time")}
                  />
                  {fieldError("workshop_entry_time")}
                </div>
              </div>

              <div className="mb-6">
                <SearchableSelect
                  label="Sistema Afectado"
                  helpText="Area o sistema del vehiculo donde ocurrio la falla (ej: Frenos, Motor, Sistema electrico). Obligatorio."
                  value={formData.system_category}
                  options={selectOptions(categories.system_category, formData.system_category)}
                  onChange={(v) => updateField("system_category", v)}
                  placeholder={catsLoading ? "Cargando..." : "Seleccionar sistema..."}
                  required
                  disabled={catsLoading}
                />
                {fieldError("system_category")}
              </div>

              <div className="mb-6">
                <SearchableSelect
                  label="Componente"
                  helpText="Parte especifica dentro del sistema afectado (ej: pastillas de freno, alternador). Obligatorio."
                  value={formData.component_id}
                  options={selectOptions(categories.component, formData.component_id)}
                  onChange={(v) => updateField("component_id", v)}
                  placeholder={catsLoading ? "Cargando..." : "Seleccionar componente..."}
                  required
                  disabled={catsLoading}
                />
                {fieldError("component_id")}
              </div>

              <div className="mb-6">
                <SearchableSelect
                  label="Accion Realizada"
                  helpText="Que se hizo para resolver el evento (ej: Reemplazado, Reparado, Ajustado). Obligatorio."
                  value={formData.action_taken}
                  options={selectOptions(categories.action_taken, formData.action_taken)}
                  onChange={(v) => updateField("action_taken", v)}
                  placeholder={catsLoading ? "Cargando..." : "Seleccionar accion..."}
                  required
                  disabled={catsLoading}
                />
                {fieldError("action_taken")}
              </div>

              <div className="mb-6">
                <SearchableSelect
                  label="Causa Raiz"
                  helpText="Por que ocurrio la falla (ej: Desgaste natural, Error del operador). Opcional, pero muy recomendable para las acciones preventivas."
                  value={formData.root_cause}
                  options={selectOptions(categories.root_cause, formData.root_cause)}
                  onChange={(v) => updateField("root_cause", v)}
                  placeholder={catsLoading ? "Cargando..." : "Seleccionar causa raiz..."}
                  disabled={catsLoading}
                />
                {fieldError("root_cause")}
              </div>

              <div className="mb-6 p-3 rounded-xl text-xs" style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-700)", color: "var(--graphite-500)" }}>
                Horas efectivas, costo de reparacion y fecha de salida se determinan al cerrar el evento desde el dashboard.
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => router.push(`/records/${id}`)}
                  className="px-5 py-2.5 rounded-xl font-medium text-sm cursor-pointer transition-all"
                  style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-700)", color: "var(--graphite-300)" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || catsLoading}
                  className="px-5 py-2.5 rounded-xl font-medium text-sm cursor-pointer transition-all disabled:opacity-50"
                  style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}
                >
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
