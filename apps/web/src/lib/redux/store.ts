import { configureStore, combineReducers } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import dropdownDataReducer from "./slices/dropdownDataSlice";
import vehiclesReducer from "./slices/vehiclesSlice";

const rootReducer = combineReducers({
  auth: authReducer,
  dropdownData: dropdownDataReducer,
  vehicles: vehiclesReducer,
});

export const makeStore = () =>
  configureStore({
    reducer: rootReducer,
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
