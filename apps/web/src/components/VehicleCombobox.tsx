"use client";

import { useEffect, useRef, useState } from "react";
import VehicleModal from "@/components/VehicleModal";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { addVehicle, removeVehicle, setLoading, setVehicles } from "@/lib/redux/slices/vehiclesSlice";
import { deleteVehicle, getVehicles, normalizeVehicleId } from "@/lib/services/vehicleService";
import type { Vehicle } from "@/types/vehicle";

const inputStyle = {
  backgroundColor: "var(--graphite-800)",
  border: "1px solid var(--graphite-600)",
  color: "var(--graphite-100)",
};

interface VehicleComboboxProps {
  value: string;
  onChange: (value: string) => void;
  enterpriseId: string | null;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  name?: string;
}

export default function VehicleCombobox({
  value,
  onChange,
  enterpriseId,
  placeholder = "Ej: ABC-123",
  inputRef,
  name,
}: VehicleComboboxProps) {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const vehiclesState = useAppSelector((state) => state.vehicles);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onSubmitCapture = (e: Event) => {
      const target = e.target as HTMLElement;
      console.log("[VC] native submit captured", { tag: target?.tagName, cls: (target?.getAttribute?.("class") ?? "").slice(0, 50) });
    };
    const onSubmitBubble = (e: Event) => {
      console.log("[VC] native submit bubble defaultPrevented:", e.defaultPrevented);
    };
    const onBeforeUnload = () => console.log("[VC] BEFOREUNLOAD - page is unloading");
    document.addEventListener("submit", onSubmitCapture, true);
    document.addEventListener("submit", onSubmitBubble, false);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("submit", onSubmitCapture, true);
      document.removeEventListener("submit", onSubmitBubble, false);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    const hasCache = Boolean(enterpriseId && vehiclesState.byEnterprise[enterpriseId]);
    const loadFlag = Boolean(enterpriseId && vehiclesState.loading[enterpriseId]);
    console.log("[VC] effect", { ent: enterpriseId ?? null, hasCache, loadFlag });
    if (!enterpriseId) return;
    if (hasCache || loadFlag) return;
    dispatch(setLoading({ enterpriseId, loading: true }));
    getVehicles(enterpriseId)
      .then((list) => { console.log("[VC] fetched", list.length, list.map((v) => v.vehicle_id)); dispatch(setVehicles({ enterpriseId, vehicles: list })); })
      .catch((err) => {
        console.error("[VC] Error cargando vehiculos:", err);
        dispatch(setLoading({ enterpriseId, loading: false }));
      });
  }, [enterpriseId, dispatch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [value]);

  const vehicles = enterpriseId ? vehiclesState.byEnterprise[enterpriseId] ?? [] : [];
  const isLoading = enterpriseId ? vehiclesState.loading[enterpriseId] ?? false : false;
  const q = value.trim().toUpperCase();
  const normalized = normalizeVehicleId(value);
  const normalizedQ = normalized.replace(/-/g, "");
  const matched = vehicles.find((v) => v.vehicle_id === normalized || (v.vehicle_code ? v.vehicle_code === q : false)) ?? null;
  const matches = vehicles
    .filter(
      (v) =>
        !q ||
        v.vehicle_id.replace(/-/g, "").includes(normalizedQ) ||
        (v.vehicle_code ? v.vehicle_code.includes(q) : false) ||
        v.brand.toUpperCase().includes(q) ||
        v.model.toUpperCase().includes(q),
    )
    .slice(0, 8);
  const showSave = Boolean(enterpriseId) && q.length > 0 && !matched && !isLoading;
  const showEmpty = vehicles.length === 0 && q.length === 0 && !isLoading;

  console.log("[VC]", { open, value, q, n: vehicles.length, loading: isLoading, ent: enterpriseId, matched: matched?.vehicle_id ?? null, showSave, ids: vehicles.map((v) => v.vehicle_id) });

  const selectVehicle = (vehicleId: string) => {
    console.log("[VC] select", vehicleId);
    onChange(vehicleId);
    setOpen(false);
  };

  const handleDeleteVehicle = async (v: Vehicle) => {
    if (!enterpriseId || deleting) return;
    if (!window.confirm(`Eliminar el vehiculo ${v.vehicle_id} del catalogo? Sus eventos no se borran.`)) return;
    setDeleting(v.vehicle_id);
    try {
      await deleteVehicle(v);
      dispatch(removeVehicle({ enterpriseId, vehicleId: v.vehicle_id }));
      if (value === v.vehicle_id || (v.vehicle_code ? value === v.vehicle_code : false)) onChange("");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo eliminar el vehiculo");
    } finally {
      setDeleting(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < matches.length) {
        e.preventDefault();
        selectVehicle(matches[activeIndex].vehicle_id);
      } else if (matches.length === 1) {
        e.preventDefault();
        selectVehicle(matches[0].vehicle_id);
      }
    }
  };

  return (
    <div ref={containerRef} onKeyDown={handleKeyDown}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onBlur={() => {
            if (value.trim()) onChange(normalizeVehicleId(value));
            setOpen(false);
          }}
          onFocus={() => { setOpen(true); setActiveIndex(-1); }}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
          style={inputStyle}
        />

        {open && enterpriseId && (
          <div
            className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl border overflow-hidden"
            style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }}
          >
            <div className="max-h-60 overflow-y-auto text-sm">
              {isLoading && vehicles.length === 0 && (
                <div className="px-4 py-3 text-sm cursor-default" style={{ color: "var(--graphite-500)" }}>
                  Cargando...
                </div>
              )}

              {showEmpty && (
                <div className="px-4 py-3 text-sm" style={{ color: "var(--graphite-500)" }}>
                  Aun no hay vehiculos registrados
                </div>
              )}

              {matches.map((v, idx) => (
                <div
                  key={v.id}
                  className="flex items-center"
                  style={{ backgroundColor: idx === activeIndex ? "var(--graphite-800)" : "transparent" }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <button
                    type="button"
                    onClick={() => selectVehicle(v.vehicle_id)}
                    className="flex-1 min-w-0 px-4 py-2 text-left cursor-pointer transition-colors"
                  >
                    <span className="block font-medium" style={{ color: "var(--graphite-100)" }}>{v.vehicle_id}</span>
                    <span className="block text-xs truncate" style={{ color: "var(--graphite-400)" }}>{v.vehicle_code ? `${v.vehicle_code} · ` : ""}{v.brand} {v.model} {v.year}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteVehicle(v)}
                    disabled={deleting !== null}
                    title="Eliminar vehiculo"
                    className="px-3 py-2 mr-1 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ color: "var(--graphite-500)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--raspberry-red-400)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--graphite-500)"; }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {showSave && (
                <div className="p-2">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setShowModal(true); setOpen(false); }}
                    className="w-full px-3 py-2 rounded-lg text-left text-sm cursor-pointer transition-colors"
                    style={{ border: "1px dashed var(--graphite-600)", color: "var(--graphite-400)", backgroundColor: "transparent" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--graphite-200)"; e.currentTarget.style.borderColor = "var(--graphite-500)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--graphite-400)"; e.currentTarget.style.borderColor = "var(--graphite-600)"; }}
                  >
                    {`+ Guardar vehiculo '${q}'`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {matched && (
        <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: "rgba(102, 153, 145, 0.15)", color: "var(--ash-grey-400)" }}>
          ✓ Registrado — {matched.vehicle_code ? `${matched.vehicle_code} · ` : ""}{matched.brand} {matched.model} {matched.year}
        </span>
      )}

      {showModal && enterpriseId && (
        <VehicleModal
          initialVehicleId={value}
          enterpriseId={enterpriseId}
          createdBy={user?.uid || ""}
          onSaved={(v) => {
            setShowModal(false);
            dispatch(addVehicle({ enterpriseId, vehicle: v }));
            onChange(v.vehicle_id);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
