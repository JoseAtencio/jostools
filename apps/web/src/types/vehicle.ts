export interface Vehicle {
  id: string;
  vehicle_id: string;
  brand: string;
  model: string;
  year: number;
  enterpriseId: string;
  created_by: string;
  created_at: string;
  fleet_group?: string;
}

export type VehicleInput = Omit<Vehicle, "id" | "created_at">;

export const FLEET_GROUP_OPTIONS = ["MQ", "VP-EP-VB-VC", "VL-TP", "Maquinaria", "Carga pesada", "Livianos"];
