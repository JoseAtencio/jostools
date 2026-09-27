import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { logout } from "./authSlice";
import type { Vehicle } from "@/types/vehicle";

interface VehiclesState {
  byEnterprise: Record<string, Vehicle[]>;
  loading: Record<string, boolean>;
}

const initialState: VehiclesState = { byEnterprise: {}, loading: {} };

const slice = createSlice({
  name: "vehicles",
  initialState,
  reducers: {
    setVehicles(state, action: PayloadAction<{ enterpriseId: string; vehicles: Vehicle[] }>) {
      state.byEnterprise[action.payload.enterpriseId] = action.payload.vehicles;
      state.loading[action.payload.enterpriseId] = false;
    },
    setLoading(state, action: PayloadAction<{ enterpriseId: string; loading: boolean }>) {
      state.loading[action.payload.enterpriseId] = action.payload.loading;
    },
    addVehicle(state, action: PayloadAction<{ enterpriseId: string; vehicle: Vehicle }>) {
      const list = state.byEnterprise[action.payload.enterpriseId] ?? [];
      const index = list.findIndex((v) => v.vehicle_id === action.payload.vehicle.vehicle_id);
      if (index >= 0) list[index] = action.payload.vehicle;
      else list.push(action.payload.vehicle);
      state.byEnterprise[action.payload.enterpriseId] = list;
    },
    resetVehicles() { return initialState; },
  },
  extraReducers: (builder) => {
    builder.addCase(logout.fulfilled, () => initialState);
  },
});

export const { setVehicles, setLoading, addVehicle, resetVehicles } = slice.actions;
export default slice.reducer;
