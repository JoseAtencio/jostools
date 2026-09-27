import { collection, doc, getDoc, getDocs, query, setDoc, where } from "@firebase/firestore";
import { db } from "@jostools/firebase-config";
import type { Vehicle, VehicleInput } from "@/types/vehicle";

const vehiclesRef = collection(db, "jostools", "config", "vehicles");

export function normalizeVehicleId(raw: string): string {
  return raw.toUpperCase().trim().replace(/[^A-Z0-9-]/g, "");
}

function toVehicle(id: string, data: Record<string, any>): Vehicle {
  return {
    id,
    vehicle_id: data.vehicle_id ?? "",
    brand: data.brand ?? "",
    model: data.model ?? "",
    year: Number(data.year ?? 0),
    enterpriseId: data.enterpriseId ?? "",
    created_by: data.created_by ?? "",
    created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
  };
}

export async function getVehicles(enterpriseId: string): Promise<Vehicle[]> {
  const q = query(vehiclesRef, where("enterpriseId", "==", enterpriseId));
  const snapshot = await getDocs(q);
  const vehicles = snapshot.docs.map((d) => toVehicle(d.id, d.data()));
  vehicles.sort((a, b) => a.vehicle_id.localeCompare(b.vehicle_id));
  return vehicles;
}

export async function getVehicleById(enterpriseId: string, vehicleId: string): Promise<Vehicle | null> {
  const id = `${enterpriseId}_${normalizeVehicleId(vehicleId)}`;
  const snap = await getDoc(doc(vehiclesRef, id));
  if (!snap.exists()) return null;
  return toVehicle(snap.id, snap.data());
}

export async function createVehicle(data: VehicleInput): Promise<Vehicle> {
  const vehicleId = normalizeVehicleId(data.vehicle_id);
  const maxYear = new Date().getFullYear() + 1;
  if (!vehicleId) throw new Error("La matricula es requerida");
  if (typeof data.year !== "number" || Number.isNaN(data.year) || data.year < 1900 || data.year > maxYear)
    throw new Error(`El anio debe estar entre 1900 y ${maxYear}`);
  if (!data.brand || !data.brand.trim()) throw new Error("La marca es requerida");
  if (!data.model || !data.model.trim()) throw new Error("El modelo es requerido");

  const snapshot = await getDocs(query(vehiclesRef, where("enterpriseId", "==", data.enterpriseId)));
  if (snapshot.docs.some((d) => d.data().vehicle_id === vehicleId))
    throw new Error("Esta matricula ya esta registrada");

  const id = `${data.enterpriseId}_${vehicleId}`;
  const created_at = new Date().toISOString();
  await setDoc(doc(vehiclesRef, id), {
    vehicle_id: vehicleId,
    brand: data.brand.trim(),
    model: data.model.trim(),
    year: data.year,
    enterpriseId: data.enterpriseId,
    created_by: data.created_by,
    created_at,
  });
  return {
    id,
    vehicle_id: vehicleId,
    brand: data.brand.trim(),
    model: data.model.trim(),
    year: data.year,
    enterpriseId: data.enterpriseId,
    created_by: data.created_by,
    created_at,
  };
}
