"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import HelpTip from "@/components/HelpTip";
import FuelMovementModal from "@/components/FuelMovementModal";
import { useAppSelector } from "@/lib/redux/hooks";
import { getVehicles } from "@/lib/services/vehicleService";
import type { Vehicle } from "@/types/vehicle";
import {
  getFuelMovements, getFuelInitialLiters, saveFuelInitialLiters, deleteFuelMovement,
  balanceOf, cierreOf, litrosPorDia, monthLabelOfKey, getFuelMonthOptions,
} from "@/lib/services/fuelKardexService";
import { exportFuelToExcel, exportFuelToPdf } from "@/lib/services/fuelExportService";
import { FUEL_CATEGORIES, FUEL_CATEGORY_LABELS, FUEL_TIPO_LABELS, type FuelCategory, type FuelMovement } from "@/types/fuel";

const kpiCard = (label: string, value: string, help: string) => (
  <div key={label} className="rounded-2xl border p-4" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
    <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--graphite-500)" }}>
      {label}
      <HelpTip title={label} text={help} />
    </p>
    <p className="text-xl font-bold" style={{ color: "var(--graphite-100)" }}>{value}</p>
  </div>
);

const categoriaBadgeColor: Record<FuelCategory, string> = {
  interno: "var(--graphite-300)",
  planta: "var(--tuscan-sun-400)",
  sindicato: "var(--crayola-blue-400)",
  tercero: "var(--raspberry-red-400)",
  compra: "var(--ash-grey-400)",
};

export default function CombustiblePage() {
  const { user } = useAppSelector((state) => state.auth);
  const [movements, setMovements] = useState<FuelMovement[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [initialLiters, setInitialLiters] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthKey, setMonthKey] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [filterVehiculo, setFilterVehiculo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FuelMovement | null>(null);
  const [deleting, setDeleting] = useState<FuelMovement | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState("");
  const [configError, setConfigError] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadData = () => {
    if (!user?.enterpriseId) return;
    Promise.all([
      getFuelMovements(user.enterpriseId),
      getVehicles(user.enterpriseId),
      getFuelInitialLiters(user.enterpriseId),
    ])
      .then(([movs, vehs, initial]) => {
        setError("");
        setMovements(movs);
        setVehicles(vehs);
        setInitialLiters(initial);
        setConfigDraft(String(initial));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError("No se pudo cargar el kardex de gasoil.");
      });
  };

  useEffect(() => { loadData(); }, [user?.enterpriseId]);

  const monthOptions = useMemo(() => getFuelMonthOptions(movements), [movements]);

  useEffect(() => {
    if (monthOptions.length === 0) return;
    if (!monthKey || !monthOptions.includes(monthKey)) setMonthKey(monthOptions[0]);
  }, [monthOptions, monthKey]);

  const vehicleLabel = useMemo(() => {
    const map = new Map(vehicles.map((v): [string, string] => [v.vehicle_id, v.vehicle_id]));
    return (id: string) => map.get(id) || id || "--";
  }, [vehicles]);

  const cierre = useMemo(() => cierreOf(movements, initialLiters, monthKey || monthOptions[0] || ""), [movements, initialLiters, monthKey, monthOptions]);

  const filtered = useMemo(() => {
    return cierre.movementsInMonth.filter((m) => {
      if (filterCategoria && m.categoria !== filterCategoria) return false;
      if (filterVehiculo && m.vehicle_id !== filterVehiculo) return false;
      return true;
    });
  }, [cierre, filterCategoria, filterVehiculo]);

  const balance = useMemo(() => balanceOf(movements, initialLiters), [movements, initialLiters]);
  const porDia = useMemo(() => litrosPorDia(cierre.consumo, monthKey || monthOptions[0] || ""), [cierre, monthKey, monthOptions]);

  const destinoOf = (m: FuelMovement): string => {
    if (m.categoria === "interno") return vehicleLabel(m.vehicle_id || "");
    if (m.categoria === "planta") return `Despacho asfalto (${m.toneladas ?? 0} ton x ${m.t_l ?? 0})`;
    if (m.categoria === "sindicato") return [m.chofer, m.placa ? `placa ${m.placa}` : ""].filter(Boolean).join(" - ") || "--";
    if (m.categoria === "tercero") return m.placa ? `Placa ${m.placa}` : "--";
    return m.proveedor || "--";
  };

  const handleSaveConfig = async () => {
    if (!user?.enterpriseId || savingConfig || loading) return;
    const parsed = parseFloat(configDraft);
    if (configDraft.trim() === "" || !Number.isFinite(parsed) || parsed < 0) {
      setConfigError("Ingrese un valor numerico mayor o igual a cero.");
      return;
    }
    setSavingConfig(true);
    try {
      await saveFuelInitialLiters(user.enterpriseId, parsed);
      setInitialLiters(parsed);
      setConfigError("");
      setShowConfig(false);
    } catch {
      alert("No se pudo guardar la existencia inicial");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteFuelMovement(deleting.id);
      setDeleting(null);
      loadData();
    } catch {
      alert("No se pudo borrar el movimiento");
    } finally {
      setDeleteBusy(false);
    }
  };

  const monthLabel = monthLabelOfKey(monthKey || monthOptions[0] || "");

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: "var(--graphite-950)" }}>
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h1 className="text-2xl font-bold" style={{ color: "var(--graphite-100)" }}>
              Control de gasoil
              <HelpTip title="Kardex de gasoil" text="Entradas y salidas de combustible con saldo automatico. Reemplaza el Excel CONTROL DE GASOIL: registra movimientos por categoria y el sistema calcula la existencia y el cierre del mes." />
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <select value={monthKey} onChange={(e) => setMonthKey(e.target.value)} className="px-4 py-2 rounded-xl text-sm outline-none cursor-pointer" style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{monthLabelOfKey(m)}</option>
                ))}
              </select>
              <button onClick={() => setShowConfig(!showConfig)} className="px-3 py-2 rounded-xl text-sm cursor-pointer" style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-300)" }}>
                Existencia inicial
              </button>
              <button onClick={() => { setEditing(null); setModalOpen(true); }} className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>
                + Nuevo movimiento
              </button>
              <button onClick={() => { if (monthKey) exportFuelToPdf(cierre, monthKey, vehicleLabel); }} disabled={loading || !!error || !monthKey} className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: "rgba(0, 81, 255, 0.15)", color: "var(--crayola-blue-400)", border: "1px solid rgba(0, 81, 255, 0.3)" }}>
                Exportar PDF
              </button>
              <button onClick={() => { if (monthKey) exportFuelToExcel(cierre, monthKey, vehicleLabel); }} disabled={loading || !!error || !monthKey} className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: "rgba(102, 153, 145, 0.15)", color: "var(--ash-grey-400)", border: "1px solid rgba(102, 153, 145, 0.3)" }}>
                Exportar Excel
              </button>
            </div>
          </div>

          {showConfig && (
            <div className="mb-6 p-4 rounded-2xl border flex items-end gap-3 flex-wrap" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--graphite-400)" }}>
                  Existencia inicial (litros)
                  <HelpTip title="Existencia inicial" text="Saldo de gasoil con el que arranca el kardex. Cargalo una sola vez con la existencia previa del ultimo cierre del Excel; despues el sistema arrastra el saldo solo." />
                </label>
                <input type="number" step="0.01" min="0" value={configDraft} onChange={(e) => { setConfigDraft(e.target.value); setConfigError(""); }} className="px-3 py-2 rounded-xl text-sm w-48 focus:outline-none" style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-100)" }} />
                {configError && (
                  <p className="text-xs mt-1" style={{ color: "var(--raspberry-red-400)" }}>{configError}</p>
                )}
              </div>
              <button onClick={handleSaveConfig} disabled={loading || savingConfig} className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>
                {savingConfig ? "Guardando..." : "Guardar"}
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-20" style={{ color: "var(--graphite-500)" }}>Cargando kardex...</div>
          ) : error ? (
            <div className="text-center py-20 rounded-xl" style={{ color: "var(--raspberry-red-400)", border: "1px solid var(--graphite-800)", backgroundColor: "var(--graphite-900)" }}>
              {error}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {kpiCard("Existencia actual", `${balance.existencia.toLocaleString("es-ES")} L`, "Saldo inicial mas ingresos menos egresos de todos los movimientos registrados.")}
                {kpiCard("Ingresos del mes", `${cierre.ingresos.toLocaleString("es-ES")} L`, "Litros comprados e ingresados en el mes seleccionado.")}
                {kpiCard("Consumo del mes", `${cierre.consumo.toLocaleString("es-ES")} L`, "Litros egresados en el mes seleccionado (interno, planta, sindicato y terceros).")}
                {kpiCard("Litros por dia", `${porDia.toLocaleString("es-ES")} L/dia`, "Consumo del mes dividido entre los dias transcurridos.")}
              </div>

              <div className="mb-6 p-5 rounded-2xl border" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h2 className="text-lg font-bold" style={{ color: "var(--graphite-100)" }}>Cierre de {monthLabel}</h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium" style={{
                    backgroundColor: cierre.existencia >= 0 ? "rgba(102, 153, 145, 0.15)" : "rgba(224, 31, 95, 0.15)",
                    color: cierre.existencia >= 0 ? "var(--ash-grey-400)" : "var(--raspberry-red-400)",
                  }}>
                    {cierre.existencia >= 0 ? "Cuadrado" : "Existencia negativa"}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                  {[
                    ["Existencia previa", cierre.previa],
                    ["Ingresos (compras)", cierre.ingresos],
                    ["Interno", cierre.porCategoria.interno],
                    ["Planta", cierre.porCategoria.planta],
                    ["Sindicato", cierre.porCategoria.sindicato],
                    ["Terceros", cierre.porCategoria.tercero],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl p-3" style={{ backgroundColor: "var(--graphite-950)", border: "1px solid var(--graphite-800)" }}>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--graphite-500)" }}>{label}</p>
                      <p className="text-base font-bold mt-0.5" style={{ color: "var(--graphite-100)" }}>{Number(value).toLocaleString("es-ES")} L</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm" style={{ color: "var(--graphite-400)" }}>
                  {cierre.previa.toLocaleString("es-ES")} + {cierre.ingresos.toLocaleString("es-ES")} - {cierre.consumo.toLocaleString("es-ES")} = <span className="font-bold" style={{ color: "var(--tuscan-sun-400)" }}>{cierre.existencia.toLocaleString("es-ES")} L</span>
                </p>
              </div>

              <div className="mb-4 flex items-center gap-3 flex-wrap">
                <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer" style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}>
                  <option value="">Categoria: Todas</option>
                  {FUEL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{FUEL_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
                <select value={filterVehiculo} onChange={(e) => setFilterVehiculo(e.target.value)} className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer" style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)", color: "var(--graphite-100)" }}>
                  <option value="">Vehiculo: Todos</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.vehicle_id}>{v.vehicle_id}</option>
                  ))}
                </select>
                {(filterCategoria || filterVehiculo) && (
                  <button onClick={() => { setFilterCategoria(""); setFilterVehiculo(""); }} className="text-xs px-3 py-2 rounded-xl cursor-pointer" style={{ color: "var(--graphite-400)", border: "1px solid var(--graphite-700)" }}>
                    Limpiar filtros
                  </button>
                )}
              </div>

              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                {filtered.length === 0 ? (
                  cierre.movementsInMonth.length > 0 ? (
                    <div className="px-5 py-10 text-sm text-center" style={{ color: "var(--graphite-500)" }}>
                      <p>Sin resultados con los filtros aplicados.</p>
                      <button onClick={() => { setFilterCategoria(""); setFilterVehiculo(""); }} className="mt-3 text-xs px-3 py-2 rounded-xl cursor-pointer" style={{ color: "var(--graphite-400)", border: "1px solid var(--graphite-700)" }}>
                        Limpiar filtros
                      </button>
                    </div>
                  ) : (
                    <p className="px-5 py-10 text-sm text-center" style={{ color: "var(--graphite-500)" }}>
                      Sin movimientos en {monthLabel}. Registra el primero con "Nuevo movimiento".
                    </p>
                  )
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead>
                        <tr>
                          {["Fecha", "Movimiento", "Categoria", "Vehiculo / Destino", "Obra", "Litros", "Soporte", ""].map((col) => (
                            <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ backgroundColor: "var(--graphite-800)", color: "var(--graphite-400)" }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((m) => (
                          <tr key={m.id} style={{ borderTop: "1px solid var(--graphite-800)" }}>
                            <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--graphite-300)" }}>{new Date(m.fecha).toLocaleDateString("es-ES")}</td>
                            <td className="px-4 py-2.5">
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{
                                backgroundColor: m.tipo === "entrada" ? "rgba(102, 153, 145, 0.15)" : "rgba(224, 31, 95, 0.15)",
                                color: m.tipo === "entrada" ? "var(--ash-grey-400)" : "var(--raspberry-red-400)",
                              }}>
                                {FUEL_TIPO_LABELS[m.tipo]}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ color: categoriaBadgeColor[m.categoria] }}>
                                {FUEL_CATEGORY_LABELS[m.categoria]}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: "var(--graphite-100)" }}>{destinoOf(m)}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--graphite-400)" }}>{m.obra || "--"}</td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap" style={{ color: "var(--graphite-100)" }}>{m.litros.toLocaleString("es-ES")}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--graphite-400)" }}>{m.soporte || m.nro_factura || "--"}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <button onClick={() => { setEditing(m); setModalOpen(true); }} className="px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: "rgba(0, 81, 255, 0.15)", color: "var(--crayola-blue-400)", border: "1px solid rgba(0, 81, 255, 0.3)" }}>
                                  Editar
                                </button>
                                <button onClick={() => setDeleting(m)} className="px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: "rgba(224, 31, 95, 0.15)", color: "var(--raspberry-red-400)", border: "1px solid rgba(224, 31, 95, 0.3)" }}>
                                  Borrar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {modalOpen && (
          <FuelMovementModal
            movement={editing}
            onClose={() => { setModalOpen(false); setEditing(null); }}
            onSaved={loadData}
          />
        )}

        {deleting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={() => { if (!deleteBusy) setDeleting(null); }}>
            <div className="rounded-2xl border w-full max-w-sm p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }} onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-2" style={{ color: "var(--graphite-100)" }}>Borrar movimiento</h2>
              <p className="text-sm mb-4" style={{ color: "var(--graphite-400)" }}>
                Se borrara el movimiento de {deleting.litros.toLocaleString("es-ES")} L ({FUEL_CATEGORY_LABELS[deleting.categoria]}) del {new Date(deleting.fecha).toLocaleDateString("es-ES")}. El saldo y el cierre se recalculan al instante.
              </p>
              <div className="flex gap-3">
                <button onClick={handleDelete} disabled={deleteBusy} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: "var(--raspberry-red-500)", color: "var(--graphite-50)" }}>
                  {deleteBusy ? "Borrando..." : "Borrar"}
                </button>
                <button onClick={() => setDeleting(null)} disabled={deleteBusy} className="px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-300)" }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
