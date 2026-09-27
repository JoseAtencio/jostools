"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { createVehicle } from "@/lib/services/vehicleService";
import HelpTip from "@/components/HelpTip";
import type { Vehicle } from "@/types/vehicle";

const inputStyle = {
  backgroundColor: "var(--graphite-800)",
  border: "1px solid var(--graphite-600)",
  color: "var(--graphite-100)",
};

interface VehicleModalProps {
  initialVehicleId: string;
  enterpriseId: string;
  createdBy: string;
  onSaved: (vehicle: Vehicle) => void;
  onClose: () => void;
}

export default function VehicleModal({ initialVehicleId, enterpriseId, createdBy, onSaved, onClose }: VehicleModalProps) {
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const maxYear = new Date().getFullYear() + 1;

  const clearError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!vehicleId.trim()) errors.vehicle_id = "La matricula es requerida";
    if (!brand.trim()) errors.brand = "La marca es requerida";
    if (!model.trim()) errors.model = "El modelo es requerido";
    const parsedYear = Number(year);
    if (!year.trim()) errors.year = "El anio es requerido";
    else if (Number.isNaN(parsedYear) || parsedYear < 1900 || parsedYear > maxYear)
      errors.year = `El anio debe estar entre 1900 y ${maxYear}`;
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("[VC] modal submit, validating");
    setServerError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) { console.log("[VC] modal validation failed", errors); return; }

    setLoading(true);
    console.log("[VC] modal createVehicle start");
    try {
      const vehicle = await createVehicle({
        vehicle_id: vehicleId,
        brand,
        model,
        year: Number(year),
        enterpriseId,
        created_by: createdBy,
      });
      console.log("[VC] modal saved OK", vehicle.vehicle_id);
      onSaved(vehicle);
    } catch (err) {
      console.error("[VC] modal save FAILED", err);
      setServerError(err instanceof Error ? err.message : "No se pudo guardar el vehiculo");
      setLoading(false);
    }
  };

  const errorStyle = (field: string) =>
    fieldErrors[field] ? { ...inputStyle, borderColor: "var(--raspberry-red-400)" } : inputStyle;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="rounded-2xl border w-full max-w-sm p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: "var(--graphite-100)" }}>
            Nuevo Vehiculo
            <HelpTip title="Catalogo de vehiculos" text="Registra un vehiculo nuevo en el catalogo de la empresa para poder abrirle eventos de mantenimiento. Todos los campos son obligatorios (*); la matricula es el identificador unico y no se puede repetir." />
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg cursor-pointer" style={{ color: "var(--graphite-500)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--graphite-200)"; e.currentTarget.style.backgroundColor = "var(--graphite-800)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--graphite-500)"; e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {serverError && (
          <div className="mb-4 p-3 rounded-xl text-sm" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>
              Matricula *
              <HelpTip title="Matricula (obligatoria)" text="Placa o VIN unico del vehiculo dentro de la empresa. Ej: ABC-123. No se puede repetir: es la clave con la que se relacionan todos sus eventos. Si ya existe, no vuelva a crearla." />
            </label>
            <input
              type="text"
              autoFocus
              value={vehicleId}
              onChange={(e) => { setVehicleId(e.target.value.toUpperCase()); clearError("vehicle_id"); }}
              placeholder="Ej: ABC-123"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={errorStyle("vehicle_id")}
            />
            {fieldErrors.vehicle_id && (
              <p className="mt-1 text-[11px]" style={{ color: "var(--raspberry-red-400)" }}>{fieldErrors.vehicle_id}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>
              Marca *
              <HelpTip title="Marca (obligatoria)" text="Marca del vehiculo o maquinaria. Ej: Toyota, Chevrolet, Caterpillar. Se usa para filtrar y buscar en el catalogo de vehiculos." />
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => { setBrand(e.target.value); clearError("brand"); }}
              placeholder="Ej: Toyota"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={errorStyle("brand")}
            />
            {fieldErrors.brand && (
              <p className="mt-1 text-[11px]" style={{ color: "var(--raspberry-red-400)" }}>{fieldErrors.brand}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>
              Modelo *
              <HelpTip title="Modelo (obligatorio)" text="Modelo del vehiculo. Ej: Hilux, Aveo, 320D. Junto con la marca identifica el vehiculo en el catalogo y en los reportes." />
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => { setModel(e.target.value); clearError("model"); }}
              placeholder="Ej: Hilux"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={errorStyle("model")}
            />
            {fieldErrors.model && (
              <p className="mt-1 text-[11px]" style={{ color: "var(--raspberry-red-400)" }}>{fieldErrors.model}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>
              Anio *
              <HelpTip title="Anio (obligatorio)" text={`Anio de fabricacion entre 1900 y ${maxYear}. Ej: 2020. Se muestra en las filas del catalogo junto con placa, marca y modelo.`} />
            </label>
            <input
              type="number"
              min={1900}
              max={maxYear}
              value={year}
              onChange={(e) => { setYear(e.target.value); clearError("year"); }}
              placeholder="Ej: 2020"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={errorStyle("year")}
            />
            {fieldErrors.year && (
              <p className="mt-1 text-[11px]" style={{ color: "var(--raspberry-red-400)" }}>{fieldErrors.year}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all disabled:opacity-50 cursor-pointer" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>
              {loading ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2.5 rounded-xl font-medium text-sm cursor-pointer" style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-300)" }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
