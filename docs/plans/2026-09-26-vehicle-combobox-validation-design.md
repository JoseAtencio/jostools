# Diseño: Selector de vehiculo con filtro en Redux + validacion de formularios

**Fecha:** 2026-09-26
**Estado:** Aprobado por el usuario

## Contexto

El campo "ID Vehiculo (Placa/VIN)" usa un `<input>` con `<datalist>` que lee Firestore en cada montaje del componente y solo filtra por prefijo de placa. El usuario quiere:

1. Un **selector (combobox)** con sugerencias mientras escribe, filtrando por **placa, marca o modelo**.
2. El catálogo de vehículos **cargado una sola vez en Redux**, con el filtro funcionando 100% en memoria para evitar consumo de Firestore mientras se escribe.
3. Si la placa no existe, **opción de agregar el vehículo** desde el propio dropdown.
4. **Auditar y completar la validación de los 4 formularios** de la app (decisión del usuario: los 4).

## Enfoque elegido

**Opción A (aprobada):** nuevo componente `VehicleCombobox` + nuevo slice `vehiclesSlice`. Se descartaron:

- **B — datalist nativo + Redux:** solo filtra prefijo de placa, sin UX propia ni opción "agregar" en la lista.
- **C — reusar SearchableSelect:** es un select (no texto libre), `onCreateNew` crearía categorías no vehículos, y afectaría los formularios existentes.

## Componentes

### 1. `vehiclesSlice` (Redux)

Patrón idéntico a `dropdownDataSlice`:

- **Estado:** `Record<enterpriseId, { vehicles: Vehicle[]; fetchedAt: number }>` + `loading: Record<enterpriseId, boolean>`.
- **`loadVehicles(enterpriseId)` (thunk):** si ya existe la entrada, **no llama a Firestore** (carga única por sesión); si no, llama a `getVehicles` y guarda. `force` opcional para refresco futuro.
- **`addVehicle(vehicle)`:** al guardar desde el modal, actualiza la caché localmente (reemplaza por `vehicle_id` si existe).
- **`resetVehicles()`:** al logout — extraReducer sobre `auth/logout.fulfilled` + `AuthListener` (mismo patrón que `dropdownDataSlice`).
- **Limitación conocida (aceptada):** vehículos que otros usuarios agreguen en otra sesión no aparecen hasta recargar la página.

### 2. `VehicleCombobox` (nuevo componente)

- **Reemplaza** a `VehiclePlateInput` en `MaintenanceForm` y `QuickOpenForm`; conserva el mismo contrato de props (`value`, `onChange`, `enterpriseId`, `placeholder`, `inputRef`, `name`) para que el swap sea trivial.
- **`VehiclePlateInput.tsx` se elimina** (queda código muerto).
- **Comportamiento:**
  - Al enfocar abre el dropdown (muestra placas); mientras escribe filtra **en memoria** sobre el catálogo de Redux por subcadena en `vehicle_id`, `brand` o `model` (case-insensitive), máximo ~8 filas: placa en negrita + `Marca Modelo Año`.
  - Teclado: ↑↓ navegar, Enter elegir, Esc cerrar; click fuera cierra (`mousedown` con listener).
  - **Sin coincidencias** (con texto no vacío): fila **`+ Guardar vehículo 'XYZ'`** dentro del dropdown → abre `VehicleModal`; al guardar → `addVehicle` al cache + selecciona la placa.
  - Se conserva la píldora **"✓ Registrado — Marca Modelo Año"** debajo del input cuando hay coincidencia exacta.
  - En el montaje dispara `loadVehicles(enterpriseId)` (que no vuelve a Firestore si ya hay caché).
- **Estilo:** sigue `inputStyle` graphite, filas del dropdown como los menús existentes (mismo look que SearchableSelect).

### 3. Validación — los 4 formularios

| Formulario | Cambios |
|---|---|
| **MaintenanceForm** | JS: `current_odometer` requerido; `current_odometer`, `effective_work_hours`, `repair_cost` ≥ 0 si se escriben. Quitar `required` nativo del odómetro (errores rojos por campo, consistente con el resto). |
| **QuickOpenForm** | Banner enumera campos faltantes con su etiqueta ("Faltan: Vehiculo, Fecha de falla") en vez de genérico; valida `workshop_entry_time >= failure_timestamp` (mismo texto que MaintenanceForm). |
| **CloseEventModal** | Quitar `required` nativo de `workshop_exit_time` (la validación JS del banner ya cubre requerida + orden). |
| **VehicleModal** | Sin cambios (4 campos requeridos + rango de año 1900–actual ya funcionan). |

## Flujo de datos

```
montaje → dispatch loadVehicles(empresa) → ¿caché? ─sí─→ nada (0 lecturas)
                                └no─→ getVehicles() → setVehicles
escribir → filtro substring en memoria (slice) → filas dropdown
"+ Guardar" → VehicleModal → createVehicle → addVehicle(cache) + seleccionar
logout → resetVehicles()
```

## Errores y edge cases

- **Fallo de carga del catálogo:** el combobox sigue funcionando con texto libre (la validación/normalización no depende del catálogo); el error va a `console.error` igual que `dropdownDataSlice`.
- **Doble apertura del modal:** el dropdown se cierra al abrir `VehicleModal`.
- **Prefill de último vehículo** (MaintenanceForm) setea `value` directamente — el combobox muestra la píldora "✓ Registrado" sin abrir dropdown.
- **Empresa sin vehículos:** al enfocar muestra solo la fila "+ Guardar vehículo".

## Verificación

- `npx tsc --noEmit` (workdir `apps/web`) y `npm run build` (raíz).
- No hay test framework para UI; verificación manual de la lista de chequeo del plan.
- Sin cambios en Firestore → **no toca rules ni tests del emulador**.

## Fuera de alcance (YAGNI)

- Edición/eliminación de vehículos.
- Recarga periódica (TTL) del catálogo de vehículos.
- Sincronización en tiempo real (listeners) del catálogo.
- Normalización retroactiva de eventos existentes.
