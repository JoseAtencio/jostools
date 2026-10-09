"use client";

import { useState } from "react";
import HelpTip from "@/components/HelpTip";
import { FLEET_GROUP_OPTIONS, type Vehicle } from "@/types/vehicle";
import { updateVehicleFleetGroup } from "@/lib/services/vehicleService";

interface FleetGroupConfigProps {
  vehicles: Vehicle[];
  onSaved: () => void;
}

export default function FleetGroupConfig({ vehicles, onSaved }: FleetGroupConfigProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Record<string, string>>(() =>
    Object.fromEntries(vehicles.map((v) => [v.vehicle_id, v.fleet_group ?? ""]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valueFor = (v: Vehicle) => (v.vehicle_id in groups ? groups[v.vehicle_id] : v.fleet_group ?? "");
  const pending = vehicles.filter((v) => valueFor(v) !== (v.fleet_group ?? ""));
  const sinGrupo = vehicles.filter((v) => !v.fleet_group?.trim()).length;

  const save = async () => {
    setSaving(true);
    setError(null);
    let savedOk = 0;
    let failure: string | null = null;
    try {
      for (const v of pending) {
        try {
          await updateVehicleFleetGroup(v, valueFor(v));
          savedOk += 1;
        } catch (err) {
          failure = `${v.vehicle_id}: ${err instanceof Error ? err.message : "No se pudo guardar"}`;
          break;
        }
      }
      if (failure) {
        setError(`No se pudieron guardar todos los grupos (${savedOk} guardados). Fallo en ${failure}`);
      }
    } finally {
      onSaved();
      setSaving(false);
    }
  };

  const selectStyle = {
    backgroundColor: "var(--graphite-800)",
    border: "1px solid var(--graphite-600)",
    color: "var(--graphite-100)",
  };

  return (
    <div className="mb-6 rounded-2xl border" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
      >
        <span className="text-sm font-semibold" style={{ color: "var(--graphite-200)" }}>
          Configurar flota
          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "rgba(247, 183, 8, 0.15)", color: "var(--tuscan-sun-400)" }}>
            {sinGrupo} sin grupo
          </span>
          <HelpTip title="Grupo de flota" text="Asigna cada vehiculo a un grupo (MQ, VP-EP-VB-VC, VL-TP, Maquinaria, Carga pesada, Livianos) para que el Informe Mensual pueda mostrar la distribucion por tipo de flota. Los vehiculos sin grupo aparecen como 'Sin grupo'." />
        </span>
        <svg className="w-4 h-4 transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "var(--graphite-400)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5">
          {error && (
            <div className="mb-3 p-3 rounded-xl text-sm" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
              {error}
            </div>
          )}
          <div className="max-h-80 overflow-y-auto rounded-xl" style={{ border: "1px solid var(--graphite-800)" }}>
            {vehicles.map((v, i) => {
              const val = valueFor(v);
              const custom = val !== "" && !FLEET_GROUP_OPTIONS.includes(val);
              return (
                <div
                  key={v.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--graphite-800)" }}
                >
                  <span className="w-32 font-mono text-[13px] font-semibold shrink-0" style={{ color: "var(--graphite-100)" }}>{v.vehicle_id}</span>
                  <span className="flex-1 text-sm truncate" style={{ color: "var(--graphite-400)" }}>{`${v.brand} ${v.model} ${v.year || ""}`.trim()}</span>
                  <select
                    value={val}
                    onChange={(e) => setGroups((prev) => ({ ...prev, [v.vehicle_id]: e.target.value }))}
                    className="px-3 py-1.5 rounded-lg text-xs outline-none cursor-pointer shrink-0"
                    style={selectStyle}
                  >
                    <option value="">Sin grupo</option>
                    {FLEET_GROUP_OPTIONS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                    {custom && <option key={val} value={val}>{val}</option>}
                  </select>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || pending.length === 0}
              className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all disabled:opacity-50"
              style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}
            >
              {saving ? "Guardando..." : `Guardar${pending.length > 0 ? ` (${pending.length})` : ""}`}
            </button>
            <span className="text-xs" style={{ color: "var(--graphite-500)" }}>
              {pending.length > 0 ? `${pending.length} cambio(s) sin guardar` : "Todo guardado"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
