"use client";

import { useRef, useState } from "react";
import HelpTip from "@/components/HelpTip";
import VehicleCombobox from "@/components/VehicleCombobox";
import { useAppSelector } from "@/lib/redux/hooks";
import { createFuelMovement, updateFuelMovement } from "@/lib/services/fuelKardexService";
import { FUEL_CATEGORIES, FUEL_CATEGORY_LABELS, categoriaTipo, DEFAULT_T_L, type FuelCategory, type FuelMovement } from "@/types/fuel";

interface FuelMovementModalProps {
  movement?: FuelMovement | null;
  onClose: () => void;
  onSaved: () => void;
}

const inputStyle = {
  backgroundColor: "var(--graphite-800)",
  border: "1px solid var(--graphite-600)",
  color: "var(--graphite-100)",
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function FuelMovementModal({ movement, onClose, onSaved }: FuelMovementModalProps) {
  const { user } = useAppSelector((state) => state.auth);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [categoria, setCategoria] = useState<FuelCategory>(movement?.categoria ?? "interno");
  const [fecha, setFecha] = useState(movement ? movement.fecha.slice(0, 10) : todayISO());
  const [litros, setLitros] = useState(movement && movement.categoria !== "planta" ? String(movement.litros) : "");
  const [toneladas, setToneladas] = useState(movement?.toneladas != null ? String(movement.toneladas) : "");
  const [tL, setTL] = useState(movement?.t_l != null ? String(movement.t_l) : String(DEFAULT_T_L));
  const [vehicleId, setVehicleId] = useState(movement?.vehicle_id ?? "");
  const [obra, setObra] = useState(movement?.obra ?? "");
  const [chofer, setChofer] = useState(movement?.chofer ?? "");
  const [ci, setCi] = useState(movement?.ci ?? "");
  const [placa, setPlaca] = useState(movement?.placa ?? "");
  const [talonario, setTalonario] = useState(movement?.talonario ?? "");
  const [proveedor, setProveedor] = useState(movement?.proveedor ?? "");
  const [nroControl, setNroControl] = useState(movement?.nro_control ?? "");
  const [nroFactura, setNroFactura] = useState(movement?.nro_factura ?? "");
  const [soporte, setSoporte] = useState(movement?.soporte ?? "");
  const [nota, setNota] = useState(movement?.nota ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isPlanta = categoria === "planta";
  const litrosCalculados = isPlanta ? (parseFloat(toneladas) || 0) * (parseFloat(tL) || 0) : 0;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!fecha) errs.fecha = "La fecha es obligatoria.";
    if (isPlanta) {
      if (!(parseFloat(toneladas) > 0)) errs.toneladas = "Indique las toneladas despachadas.";
      if (!(parseFloat(tL) > 0)) errs.t_l = "El factor T/L debe ser mayor a cero.";
    } else if (!(parseFloat(litros) > 0)) {
      errs.litros = "Los litros deben ser mayor a cero.";
    }
    if (categoria === "interno" && !vehicleId.trim()) errs.vehicle_id = "Seleccione el vehiculo.";
    if (categoria === "sindicato" && !chofer.trim()) errs.chofer = "Indique el chofer.";
    if (categoria === "tercero" && !placa.trim()) errs.placa = "Indique la placa.";
    if (categoria === "compra" && !proveedor.trim()) errs.proveedor = "Indique el proveedor.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.enterpriseId || saving) return;
    if (!validate()) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        enterpriseId: user.enterpriseId,
        fecha: new Date(`${fecha}T12:00:00`).toISOString(),
        tipo: categoriaTipo(categoria),
        categoria,
        litros: isPlanta ? Math.round(litrosCalculados * 100) / 100 : parseFloat(litros) || 0,
        vehicle_id: categoria === "interno" ? vehicleId.trim() : undefined,
        obra: obra.trim() || undefined,
        toneladas: isPlanta ? parseFloat(toneladas) || undefined : undefined,
        t_l: isPlanta ? parseFloat(tL) || undefined : undefined,
        chofer: categoria === "sindicato" ? chofer.trim() || undefined : undefined,
        ci: categoria === "sindicato" ? ci.trim() || undefined : undefined,
        placa: categoria === "sindicato" || categoria === "tercero" ? placa.trim() || undefined : undefined,
        talonario: categoria === "tercero" ? talonario.trim() || undefined : undefined,
        proveedor: categoria === "compra" ? proveedor.trim() || undefined : undefined,
        nro_control: categoria === "compra" ? nroControl.trim() || undefined : undefined,
        nro_factura: (categoria === "compra" || categoria === "sindicato") ? nroFactura.trim() || undefined : undefined,
        soporte: (categoria === "interno" || categoria === "tercero") ? soporte.trim() || undefined : undefined,
        nota: nota.trim() || undefined,
      };
      if (movement) {
        await updateFuelMovement(movement.id, payload);
      } else {
        await createFuelMovement(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el movimiento");
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (name: string) =>
    fieldErrors[name] ? <p className="text-xs mt-1" style={{ color: "var(--raspberry-red-400)" }}>{fieldErrors[name]}</p> : null;

  const labelClass = "block text-sm font-medium mb-2";
  const labelStyle = { color: "var(--graphite-300)" };
  const inputClass = "w-full px-3 py-2 rounded-xl text-sm focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) overlayRef.current = e.currentTarget; }} onClick={(e) => { if (e.target === e.currentTarget && overlayRef.current === e.currentTarget) onClose(); overlayRef.current = null; }}>
      <div className="rounded-2xl border w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4" style={{ color: "var(--graphite-100)" }}>
          {movement ? "Editar movimiento" : "Nuevo movimiento"}
          <HelpTip title="Movimiento de gasoil" text="Registra una entrada (compra) o una salida (egreso). La categoria define los campos: interno es flota propia, planta es despacho de asfalto en toneladas, sindicato y terceros son entregas fuera del catalogo, compra es ingreso de combustible." />
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>Categoria *</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value as FuelCategory)} disabled={!!movement} className={`${inputClass} cursor-pointer`} style={inputStyle}>
                {FUEL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{FUEL_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              {movement && <p className="text-xs mt-1" style={{ color: "var(--graphite-500)" }}>La categoria no se puede cambiar al editar.</p>}
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Fecha *</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} style={inputStyle} />
              {fieldError("fecha")}
            </div>
          </div>

          {categoria === "interno" && (
            <div>
              <label className={labelClass} style={labelStyle}>Vehiculo *</label>
              <VehicleCombobox value={vehicleId} onChange={setVehicleId} enterpriseId={user?.enterpriseId ?? null} placeholder="Ej: ABC-123" name="vehicle_id" />
              {fieldError("vehicle_id")}
            </div>
          )}

          {categoria === "planta" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass} style={labelStyle}>Toneladas *</label>
                <input type="number" step="0.01" min="0" value={toneladas} onChange={(e) => setToneladas(e.target.value)} className={inputClass} style={inputStyle} />
                {fieldError("toneladas")}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>T/L *</label>
                <input type="number" step="0.01" min="0" value={tL} onChange={(e) => setTL(e.target.value)} className={inputClass} style={inputStyle} />
                {fieldError("t_l")}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Litros</label>
                <input type="text" readOnly value={litrosCalculados > 0 ? litrosCalculados.toFixed(2) : "--"} className={inputClass} style={{ ...inputStyle, color: "var(--tuscan-sun-400)" }} />
              </div>
            </div>
          )}

          {!isPlanta && (
            <div>
              <label className={labelClass} style={labelStyle}>Litros *</label>
              <input type="number" step="0.01" min="0" value={litros} onChange={(e) => setLitros(e.target.value)} className={inputClass} style={inputStyle} />
              {fieldError("litros")}
            </div>
          )}

          {categoria === "sindicato" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass} style={labelStyle}>Chofer *</label>
                <input type="text" value={chofer} onChange={(e) => setChofer(e.target.value)} className={inputClass} style={inputStyle} />
                {fieldError("chofer")}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>C.I.</label>
                <input type="text" value={ci} onChange={(e) => setCi(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Placas</label>
                <input type="text" value={placa} onChange={(e) => setPlaca(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Nro Factura</label>
                <input type="text" value={nroFactura} onChange={(e) => setNroFactura(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            </div>
          )}

          {categoria === "tercero" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} style={labelStyle}>Placa *</label>
                <input type="text" value={placa} onChange={(e) => setPlaca(e.target.value)} className={inputClass} style={inputStyle} />
                {fieldError("placa")}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Nro Talonario</label>
                <input type="text" value={talonario} onChange={(e) => setTalonario(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            </div>
          )}

          {categoria === "compra" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass} style={labelStyle}>Proveedor *</label>
                <input type="text" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={inputClass} style={inputStyle} />
                {fieldError("proveedor")}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Nro Control</label>
                <input type="text" value={nroControl} onChange={(e) => setNroControl(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Nro Factura</label>
                <input type="text" value={nroFactura} onChange={(e) => setNroFactura(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            </div>
          )}

          {(categoria === "interno" || categoria === "planta" || categoria === "tercero") && (
            <div className="grid grid-cols-2 gap-3">
              {(categoria === "interno" || categoria === "planta") && (
                <div>
                  <label className={labelClass} style={labelStyle}>Obra</label>
                  <input type="text" value={obra} onChange={(e) => setObra(e.target.value)} placeholder="Ej: PATIO" className={inputClass} style={inputStyle} />
                </div>
              )}
              {(categoria === "interno" || categoria === "tercero") && (
                <div>
                  <label className={labelClass} style={labelStyle}>Soporte (Nro factura)</label>
                  <input type="text" value={soporte} onChange={(e) => setSoporte(e.target.value)} className={inputClass} style={inputStyle} />
                </div>
              )}
            </div>
          )}

          <div>
            <label className={labelClass} style={labelStyle}>Nota</label>
            <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} className={inputClass} style={inputStyle} />
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>
              {saving ? "Guardando..." : movement ? "Guardar cambios" : "Registrar movimiento"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-300)" }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
