# Diseño: Catálogo de vehículos + mejora de formularios de eventos

**Fecha:** 2026-09-26
**Estado:** Aprobado (Partes A y B)

## Contexto
- Formularios: `MaintenanceForm.tsx` (12 campos, ruta /maintenance/new),
  `QuickOpenForm.tsx` (modal de apertura rápida), `CloseEventModal.tsx` (cierre).
- **No existe entidad de vehículos**: `vehicle_id` es string libre; sin
  normalización ("abc123" vs "ABC-123" fragmentan gráficas y filtros); sin
  autocomplete; sin metadata (marca/modelo/año).

## Parte A — Catálogo de vehículos

### Datos: colección `jostools/config/vehicles`
```ts
interface Vehicle {
  id: string;
  vehicle_id: string;   // normalizado: toUpperCase().trim().replace(/[^A-Z0-9-]/g, "")
  brand: string;        // requerido
  model: string;        // requerido
  year: number;         // requerido, 1900..siguiente año
  enterpriseId: string;
  created_by: string;
  created_at: string;   // ISO
}
```
- `vehicleService.ts`: `getVehicles(enterpriseId)` (query `where enterpriseId`),
  `normalizeVehicleId(raw)`, `createVehicle({vehicle_id, brand, model, year,
  enterpriseId, created_by})` — unicidad por empresa con query previa
  (`vehicle_id + enterpriseId`) y error "Esta matricula ya esta registrada"
  (mismo patrón que invites; sin índice compuesto: 2 where → hay que crear índice
  compuesto o usar una sola condición... **decisión**: doc-id = `${enterpriseId}_${normalized}`
  para unicidad atómica sin query: `setDoc` con id derivado; create falla si ya existe
  → catch "already exists". Reglas no restringen el id).

### Reglas (bloque nuevo + tests + deploy)
```
match /jostools/config/vehicles/{vehicleId} {
  allow read: if isSignedIn() && resource.data.enterpriseId == myEnterpriseId();
  allow create: if isSignedIn()
    && request.resource.data.enterpriseId == myEnterpriseId()
    && request.resource.data.vehicle_id is string
    && request.resource.data.vehicle_id != ""
    && request.resource.data.brand is string
    && request.resource.data.model is string
    && request.resource.data.year is number;
  allow update: if isSignedIn() && resource.data.enterpriseId == myEnterpriseId();
  allow delete: if false;
}
```
Tests: read propia ✓ / ajena DENY; create propia ✓, enterpriseId ajeno DENY, campos
faltantes DENY; update propia ✓; delete DENY; regresiones de las 56 previas.

### Componentes
**`VehiclePlateInput.tsx`** (props: `value, onChange, required?` + interno):
- `<input>` con `list="vehicles-datalist"` + `<datalist>` de las placas del catálogo
  (fetch al montar con `getVehicles(enterpriseId)` — enterpriseId desde redux auth;
  si enterpriseId cambia, re-fetch)
- Normaliza al salir del input (`onBlur`): mayúsculas/espacios
- Badge debajo si `normalize(value)` coincide con un vehículo:
  `✓ Registrado — {brand} {model} {year}` (píldora verde/ash)
- Si no coincide y `value.length >= 2`: botón `+ Guardar vehículo` → abre `VehicleModal`
- `onVehicleSaved(vehicle)` callback opcional (para prellenar odómetro si se desea — YAGNI, no se usa)

**`VehicleModal.tsx`** (overlay estilo MemberModal):
- Campos: Matrícula (pre-cargada del input, editable, obligatoria, se normaliza al guardar),
  Marca (texto, req), Modelo (texto, req), Año (number, req, min 1900 max año actual+1)
- Botones: Guardar (loading "Guardando...") / Cancelar
- Errores por campo + error de servidor ("Esta matricula ya esta registrada")
- Éxito: cierra, recarga el catálogo (callback `onSaved` → VehiclePlateInput refetch)

## Parte B — 8 mejoras a `MaintenanceForm.tsx`

1. **Salida opcional**: input `workshop_exit_time` sin `required`; validación JS solo
   si llena (`salida >= entrada`); se guarda `null` si vacía → `status` sigue en PENDING.
2. **Fechas default**: `failure_timestamp` y `workshop_entry_time` = ahora (formato
   datetime-local local) al montar; botón "Ahora" pequeño al lado? NO — solo default
   + el usuario edita (YAGNI).
3. **Error por campo**: `fieldErrors: Record<string,string>`; al enviar, validar
   `vehicle_id, current_odometer (opcional? hoy no validado — se mantiene no requerido),
   event_type, system_category, component_id (req en UI → validar), action_taken,
   failure_timestamp, workshop_entry_time` + fechas; mostrar mensaje rojo bajo cada
   campo y `border-color: raspberry-red` en el input; se limpian al editar el campo.
   Eliminar el banner genérico (se conserva un resumen opcional arriba: "Revisa los
   campos marcados").
4. **Loading en selects**: `categoriesLoading` + `Promise.all` de los 5 grupos en
   paralelo; mientras carga, cada `SearchableSelect` se muestra disabled con
   placeholder "Cargando..." (agregar prop `disabled` a SearchableSelect si no existe);
   spinner general arriba de la sección.
5. **Normalizar matrícula** al guardar evento: `vehicle_id = normalizeVehicleId(raw)`
   (conserva guiones, quita espacios raros, mayúsculas). Solo eventos nuevos.
6. **Éxito con opciones**: tarjeta "Evento registrado" con
   `[Registrar otro evento]` (reset del form a defaults + foco al primer campo)
   e `[Ir al dashboard]`; quitar el redirect automático a los 2s.
7. **Aviso al cancelar**: si el form está "dirty" (cualquier campo distinto de su
   default), `window.confirm("Tienes datos sin guardar. ¿Salir?")` antes de
   `router.push("/")`; si acepta, salir.
8. **Prellenar último vehículo**: al montar, si no hay valor, cargar últimos 50
   eventos (`query(where enterpriseId, limit(50))`, orden en memoria por `created_at`
   desc — sin índice compuesto) → si hay eventos: `vehicle_id` del primero y
   `current_odometer` del último evento de ese vehículo (primer match tras ordenar);
   no pisa si el usuario ya escribió.

### `QuickOpenForm.tsx` (integración mínima)
- Reemplazar input `vehicle_id` por `VehiclePlateInput`
- `vehicle_id` normalizado al guardar
- NO: fechas default ni salida (no aplica), errores por campo (mantener su validación actual)

## Fuera de alcance (YAGNI)
- Editar/eliminar vehículos; dashboard con catálogo; librerías nuevas (zod, RHF, UI kit);
  wizard multi-paso; migración retroactiva de eventos existentes; unidades de odómetro.

## Verificación
- `npx tsc --noEmit` + `npm run build`
- Tests emulador de vehicles (8+ casos) → deploy de rules
- Manual: crear vehículo desde el form, badge ✓, autocomplete, los 8 flujos del form
