# Vehicle Combobox + Validacion de Formularios Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Selector de vehiculo con sugerencias filtradas en memoria desde Redux (placa/marca/modelo) con opcion de agregar desde el dropdown, y validacion completa y consistente en los 4 formularios.

**Architecture:** Nuevo slice `vehiclesSlice` (cache unica por empresa, actualizada localmente al crear vehiculo) + nuevo componente `VehicleCombobox` que reemplaza a `VehiclePlateInput`. Fixes de validacion JS en MaintenanceForm/QuickOpenForm y remocion de `required` nativos que interceptan antes que la validacion propia. Sin cambios en Firestore.

**Tech Stack:** Next.js 16, React 19, Redux Toolkit, Tailwind v4.

**Docs de referencia:** `docs/plans/2026-09-26-vehicle-combobox-validation-design.md` (diseño aprobado)

**Convenciones del repo:** SIN comentarios en el codigo, texto UI en espanol sin tildes, estilos inline con CSS vars (`inputStyle` graphite), verificar con `npx tsc --noEmit` (workdir `apps/web`) y `npm run build` (raiz). NO hacer commits sin permiso del usuario.

---

### Task 1: `vehiclesSlice`

**Files:**
- Create: `apps/web/src/lib/redux/slices/vehiclesSlice.ts`
- Modify: `apps/web/src/lib/redux/store.ts`
- Modify: `apps/web/src/components/AuthListener.tsx`

**Step 1: Crear el slice** (patron identico a `dropdownDataSlice.ts`):

```ts
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
```

**Step 2: Registrar en el store** — en `store.ts`: import `vehiclesReducer from "./slices/vehiclesSlice";` y agregar `vehicles: vehiclesReducer,` al objeto `reducers`.

**Step 3: Reset en logout** — en `AuthListener.tsx`: import `resetVehicles` y hacer `dispatch(resetVehicles());` junto al `dispatch(resetDropdownData());` existente (linea 38).

**Step 4: Verificar compilacion** — `npx tsc --noEmit` (workdir `apps/web`) → exit 0.

---

### Task 2: `VehicleCombobox`

**Files:**
- Create: `apps/web/src/components/VehicleCombobox.tsx`

**Step 1: Crear el componente.** Contrato de props identico a `VehiclePlateInput` (`value`, `onChange`, `enterpriseId`, `placeholder`, `inputRef`, `name`). Comportamiento:

- `useAppSelector` a `state.vehicles`; `useDispatch`.
- `useEffect` de carga: si `!enterpriseId` → nada; si `byEnterprise[enterpriseId]` existe o `loading[enterpriseId]` es true → nada (carga unica, 0 lecturas a Firestore); si no → `dispatch(setLoading(true))` + `getVehicles(enterpriseId)` → `setVehicles` / en catch `console.error` + `setVehicles([])`.
- Dropdown abierto por focus, cerrado por: Escape, click fuera (listener `mousedown` en `document` con ref), o seleccionar fila.
- Filtrado en memoria: `q = value.trim().toUpperCase()`; `matches = vehicles.filter(v => !q || v.vehicle_id.includes(q) || v.brand.toUpperCase().includes(q) || v.model.toUpperCase().includes(q)).slice(0, 8)`.
- Fila de resultado: placa en negrita (`text-sm font-medium`) + `Marca Modelo Año` en `text-xs text-[var(--graphite-400)]`; fila activa (hover/flechas) con `backgroundColor: var(--graphite-800)`.
- Navegacion teclado: ArrowDown/ArrowUp mueven `activeIndex`, Enter selecciona la fila activa, Escape cierra.
- Si `q` no vacio y no hay coincidencia exacta (`v.vehicle_id === normalizeVehicleId(value)`): ultima fila **`+ Guardar vehículo '${q}'`** → `setShowModal(true)` y cierra dropdown.
- Si la lista esta vacia y `q` vacio: fila no clickeable "Aun no hay vehiculos registrados".
- Píldora "✓ Registrado — {brand} {model} {year}" debajo del input solo cuando hay coincidencia exacta (mismo estilo que el actual: `backgroundColor: rgba(102, 153, 145, 0.15)`).
- Al guardar desde `VehicleModal`: `dispatch(addVehicle({ enterpriseId, vehicle: v }))`, `onChange(v.vehicle_id)`, cerrar modal y dropdown.
- Input: `onChange={(e) => onChange(e.target.value.toUpperCase())}`, `onBlur` normaliza con `normalizeVehicleId(value)` si no vacio, estilos identicos al input actual (`w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2`, `inputStyle`).
- Dropdown posicionado debajo del input (contenedor `relative`), `z-40`, bordes/rounded como SearchableSelect (`rounded-xl border`, `var(--graphite-700)` fondo `var(--graphite-900)`).

**Step 2: Verificar compilacion** — `npx tsc --noEmit` → exit 0 (aun sin consumidores).

---

### Task 3: Reemplazar usos y eliminar `VehiclePlateInput`

**Files:**
- Modify: `apps/web/src/components/MaintenanceForm.tsx:12,312-319`
- Modify: `apps/web/src/components/QuickOpenForm.tsx:9,132`
- Delete: `apps/web/src/components/VehiclePlateInput.tsx`

**Step 1:** En ambos forms: cambiar el import `VehiclePlateInput` → `VehicleCombobox` y renombrar la etiqueta JSX (el resto de props es identica). Mantener `inputRef`, `name`, `placeholder` donde ya se pasan.

**Step 2:** Borrar `apps/web/src/components/VehiclePlateInput.tsx` (queda codigo muerto; no hay otros consumidores — verificar con grep `VehiclePlateInput` → 0 resultados).

**Step 3:** Verificar: `npx tsc --noEmit` → exit 0.

---

### Task 4: Validacion de los 4 formularios

**Files:**
- Modify: `apps/web/src/components/MaintenanceForm.tsx` (validate ~163-187, inputs odometro/horas/costo ~323-335, 449-474)
- Modify: `apps/web/src/components/QuickOpenForm.tsx` (handleSubmit validacion ~76-79)
- Modify: `apps/web/src/components/CloseEventModal.tsx:103`
- VehicleModal: sin cambios

**Step 1 — MaintenanceForm:** agregar al final de `validate()`:

```ts
if (!formData.current_odometer.trim()) errors.current_odometer = "El odometro es requerido";
else if (parseFloat(formData.current_odometer) < 0) errors.current_odometer = "El odometro no puede ser negativo";
if (formData.effective_work_hours && parseFloat(formData.effective_work_hours) < 0) errors.effective_work_hours = "Las horas no pueden ser negativas";
if (formData.repair_cost && parseFloat(formData.repair_cost) < 0) errors.repair_cost = "El costo no puede ser negativo";
```

En el JSX: quitar `required` del input `current_odometer`; envolver los 3 inputs (odometro, horas, costo) con `style={errorStyle(...)}` y agregar `{fieldError("current_odometer")}`, `{fieldError("effective_work_hours")}`, `{fieldError("repair_cost")}` debajo de cada uno.

**Step 2 — QuickOpenForm:** reemplazar el bloque de validacion por enum de campos faltantes + orden de fechas:

```ts
const missing: string[] = [];
if (!normalizeVehicleId(formData.vehicle_id)) missing.push("Vehiculo");
if (!formData.event_type) missing.push("Tipo de evento");
if (!formData.system_category) missing.push("Categoria");
if (!formData.failure_timestamp) missing.push("Fecha de falla");
if (!formData.workshop_entry_time) missing.push("Entrada al taller");
if (missing.length > 0) {
  setError(`Faltan: ${missing.join(", ")}`);
  return;
}
if (
  formData.workshop_entry_time &&
  formData.failure_timestamp &&
  new Date(formData.workshop_entry_time) < new Date(formData.failure_timestamp)
) {
  setError("La fecha de entrada no puede ser anterior a la fecha de falla");
  return;
}
```

**Step 3 — CloseEventModal:** quitar el atributo `required` del input `workshop_exit_time` (linea 103); el banner JS ya valida requerida + orden.

**Step 4:** Verificar: `npx tsc --noEmit` → exit 0.

---

### Task 5: Verificacion final

**Step 1:** `npm run build` en la raiz → `BUILD=0`, 9/9 paginas.

**Step 2:** Checklist manual (reportar al usuario): dropdown abre al enfocar; filtra por placa/marca/modelo mientras escribe; teclado ↑↓ Enter Esc; sin coincidencia muestra "+ Guardar vehículo"; modal guarda y selecciona + aparece píldora ✓; segunda apertura no re-lee Firestore (verificar en Network que no hay requests al escribir); logout limpia la caché; MaintenanceForm muestra error rojo de odometro vacío (no tooltip del navegador); QuickOpenForm enumera campos faltantes; CloseEventModal muestra su banner sin tooltip nativo.

**Step 3:** Pedir permiso de commit al usuario (incluye tambien los features sin commitear: cache del dropdown y vehicles/forms anteriores).

**Nota:** sin cambios en Firestore ni rules → no correr el emulador.
