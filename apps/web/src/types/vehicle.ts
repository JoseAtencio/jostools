export interface Vehicle {
  id: string;
  vehicle_id: string;
  brand: string;
  model: string;
  year: number;
  enterpriseId: string;
  created_by: string;
  created_at: string;
}

export type VehicleInput = Omit<Vehicle, "id" | "created_at">;
