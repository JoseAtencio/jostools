"use client";

import { useEffect, useRef, useState } from "react";
import VehicleModal from "@/components/VehicleModal";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { addVehicle, setLoading, setVehicles } from "@/lib/redux/slices/vehiclesSlice";
import { getVehicles, normalizeVehicleId } from "@/lib/services/vehicleService";

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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enterpriseId) return;
    if (vehiclesState.byEnterprise[enterpriseId] || vehiclesState.loading[enterpriseId]) return;
    dispatch(setLoading({ enterpriseId, loading: true }));
    getVehicles(enterpriseId)
      .then((list) => { dispatch(setVehicles({ enterpriseId, vehicles: list })); })
      .catch((err) => {
        console.error("Error cargando vehiculos:", err);
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
  const matched = vehicles.find((v) => v.vehicle_id === normalized) ?? null;
  const matches = vehicles
    .filter(
      (v) =>
        !q ||
        v.vehicle_id.replace(/-/g, "").includes(normalizedQ) ||
        v.brand.toUpperCase().includes(q) ||
        v.model.toUpperCase().includes(q),
    )
    .slice(0, 8);
  const showSave = Boolean(enterpriseId) && q.length > 0 && !matched && !isLoading;
  const showEmpty = vehicles.length === 0 && q.length === 0 && !isLoading;

  const selectVehicle = (vehicleId: string) => {
    onChange(vehicleId);
    setOpen(false);
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
                <button
                  key={v.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectVehicle(v.vehicle_id)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className="w-full px-4 py-2 text-left cursor-pointer transition-colors"
                  style={{ backgroundColor: idx === activeIndex ? "var(--graphite-800)" : "transparent" }}
                >
                  <span className="block font-medium" style={{ color: "var(--graphite-100)" }}>{v.vehicle_id}</span>
                  <span className="block text-xs" style={{ color: "var(--graphite-400)" }}>{v.brand} {v.model} {v.year}</span>
                </button>
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
          ✓ Registrado — {matched.brand} {matched.model} {matched.year}
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
