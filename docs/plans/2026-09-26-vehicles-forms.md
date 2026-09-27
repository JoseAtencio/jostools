# Plan: Catálogo de vehículos + mejora de formularios

**Fecha:** 2026-09-26
**Design doc:** `2026-09-26-vehicles-forms-design.md` (aprobado)

Ejecución: 5 tareas secuenciales con subagente implementador + revisión por tarea
al final de cada una; build global al final; **pedir permiso antes de commit**.

---

## Tarea 1 — Datos: types + service + rules + tests + deploy

**Archivos nuevos:** `apps/web/src/types/vehicle.ts`, `apps/web/src/lib/services/vehicleService.ts`
**Archivo editar:** `firestore.rules` + suite de tests en Temp

1. `types/vehicle.ts`: interface `Vehicle` según design (id, vehicle_id, brand, model,
   year, enterpriseId, created_by, created_at ISO string).
2. `vehicleService.ts`:
   - `normalizeVehicleId(raw: string): string` = `raw.toUpperCase().trim().replace(/[^A-Z0-9-]/g, "")`
   - `getVehicles(enterpriseId): Promise<Vehicle[]>` — `query(where("enterpriseId","==",x))`,
     mapea (year number, created_at ISO), ordena alfabético por vehicle_id en memoria.
   - `createVehicle(data: {vehicle_id, brand, model, year, enterpriseId, created_by}): Promise<Vehicle>`
     - normaliza vehicle_id; valida no vacío, year numérico
     - **id del doc = `${enterpriseId}_${normalized}`** → unicidad atómica; `setDoc`;
       si `code === "already-exists"` throw new Error("Esta matricula ya esta registrada")
     - `created_at: new Date().toISOString()`
3. `firestore.rules`: bloque `vehicles` EXACTO del design (read/create/update con
   `enterpriseId == myEnterpriseId()`, create exigiendo campos, delete false). El resto
   sin tocar (conservar CRLF).
4. Tests en la suite de Temp (leer reglas del repo): ~8 casos del design (lectura
   propia/ajena, create ok/enterpriseId ajeno/campos faltantes, update, delete DENY)
   + correr TODA la suite (56 previos deben seguir pasando).
5. Deploy solo si todo pasa: `firebase deploy --only firestore:rules --project inventi-e1724`.

**Verificación:** suite completa pass + deploy compiled/released. No commit.

---

## Tarea 2 — Componentes: VehiclePlateInput + VehicleModal

**Archivos nuevos:** `apps/web/src/components/VehiclePlateInput.tsx`,
`apps/web/src/components/VehicleModal.tsx`

1. `VehicleModal.tsx` (leer `MemberModal.tsx` para calcar overlay/header/botones):
   - Props: `initialVehicleId: string`, `enterpriseId: string`, `createdBy: string`,
     `onSaved: (v: Vehicle) => void`, `onClose: () => void`
   - Estado: form {vehicle_id, brand, model, year}, `fieldErrors`, `serverError`,
     `loading`
   - Inputs estilo `inputStyle` del repo: Matrícula (autoFocus, se normaliza en
     onChange con `normalizeVehicleId`? no — normaliza al guardar y muestra ya en
     mayúsculas con `toUpperCase` en onChange), Marca, Modelo, Año (number
     min 1900 max currentYear+1)
   - Validación por campo (msgs sin acentos donde aplique el estilo del repo: usar
     mensajes en español normal, el repo sí usa ñ y tildes en mensajes visibles —
     seguir el estilo de mensajes existentes)
   - Enviar → `createVehicle` → `onSaved(vehicle)`; catch → `serverError`
   - Botones Guardar (loading) / Cancelar
2. `VehiclePlateInput.tsx`:
   - Props: `value: string; onChange: (v: string) => void; enterpriseId: string | null;`
     `required?: boolean; placeholder?: string; inputRef?: React.Ref<HTMLInputElement>`
   - Estado: `vehicles: Vehicle[] | null` (null = cargando), `showModal: boolean`
   - Effect: si `enterpriseId` → `getVehicles` (guard cancelled); re-fetch cuando
     `showModal` pasa a false tras guardar (o contador `version`)
   - `<input list="vehicle-plate-options">` + `<datalist id="vehicle-plate-options">`
     con `vehicle_id` de cada vehículo
   - onChange: `onChange(e.target.value.toUpperCase())` (el padre guarda el string);
     onBlur: normaliza vía `onChange(normalizeVehicleId(value))` si value no vacío
   - Badge: si `vehicles` contiene `normalizeVehicleId(value)` → píldora verde
     `✓ Registrado — {brand} {model} {year}` (texto `text-[11px]`, fondo
     `rgba(...ash/green)` — usar paleta del repo: ash-grey o tuscan; preferible
     ashtag: `var(--ash-grey-400)` texto oscuro o borde verde suave; consistencia
     con badges existentes)
   - Botón `+ Guardar vehículo` (text-[10px], borde punteado o graphite-700) visible
     si `value.length >= 2` y no coincide con catálogo → `setShowModal(true)`
   - Modal: si showModal → `<VehicleModal initialVehicleId={value} ... onSaved={(v) => { setShowModal(false); onChange(v.vehicle_id); /* bump version */ }} onClose={() => setShowModal(false)} />`
   - Si `enterpriseId` null → no fetch, sin datalist, sin botón (no rompe)
3. `SearchableSelect`: agregar prop opcional `disabled?: boolean` si no existe
   (necesario para la Tarea 3; verificar props actuales).

**Verificación:** `npx tsc --noEmit` (apps/web). No commit.

---

## Tarea 3 — MaintenanceForm: 8 mejoras + integración

**Archivo:** `apps/web/src/components/MaintenanceForm.tsx` (léelo completo)

1. **Salida opcional**: quitar `required` del input; en `fieldErrors` no la exige;
   validación `salida >= entrada` SOLO si salida tiene valor; sigue enviando
   `workshop_exit_time: ""` → null (verificar que `createMaintenanceEvent` lo hace).
2. **Fechas default**: al montar, `failure_timestamp` y `workshop_entry_time` =
   ahora en formato `YYYY-MM-DDTHH:MM` local (helper).
3. **Error por campo**: objeto `fieldErrors`; validar en submit:
   vehicle_id (requerido + normalizado no vacío), current_odometer (NO requerido,
   mantener), event_type, system_category, component_id, action_taken,
   failure_timestamp, workshop_entry_time (+ reglas de fecha ya existentes asignadas
   a los campos correspondientes: salida<entrada → error en workshop_exit_time;
   entrada<falla → error en workshop_entry_time). Mensaje por campo bajo el input
   (`text-[11px]` raspberry-red) + borde rojo (`style={{...inputStyle, borderColor:
   "var(--raspberry-red-400)"}}`); se limpia el error del campo al cambiarlo.
   Resumen arriba: "Revisa los campos marcados" solo si hay errores.
4. **Loading selects**: `const [catsLoading, setCatsLoading] = useState(true)`;
   `Promise.all` de los 5 grupos en paralelo; en el render, si `catsLoading`, cada
   SearchableSelect se reemplaza por el mismo espacio con placeholder "Cargando..."
   (usar prop `disabled` si se agregó en Tarea 2, o render condicional); al finalizar
   `setCatsLoading(false)`. Mostrar spinner svg animate-spin mientras carga.
5. **Normalizar matrícula**: `vehicle_id: normalizeVehicleId(formData.vehicle_id)` al
   construir el input del evento (y setear el formData normalizado).
6. **Éxito con opciones**: estado `savedId`; si `savedId` → tarjeta "Evento
   registrado" con botón `Registrar otro evento` (reset: defaults de fecha ahora,
   valores iniciales, `setSavedId(null)`, errores limpios) e `Ir al dashboard`
   (`router.push("/")`); eliminar el `setTimeout` de redirect.
7. **Aviso al cancelar**: estado `dirty` (true si algún campo ≠ default — tracking
   simple: comparar formData contra `initialFormData` memo, o marcar dirty en cada
   onChange — elegir el más simple y correcto); botón Cancelar → si dirty,
   `window.confirm("Tienes datos sin guardar. ¿Salir?")` → si true, push("/") ;
   si no dirty, push directo.
8. **Prellenar último vehículo**: effect al montar (paralelo a categorías):
   `query(maintenance_events, where("enterpriseId","==",x), limit(50))` → docs →
   ordenar en memoria por `created_at` desc → si hay: `vehicle_id` = primer doc; si
   el formData.vehicle_id está vacío → setearlo; odómetro = `current_odometer` del
   primer doc cuyo `vehicle_id` coincida (tras ordenar: primer doc que coincide = su
   último evento) → si formData.current_odometer vacío, setearlo. Guard con
   `user?.enterpriseId`; errores → console.error silencioso. IMPORTANTE: no pisar
   valores que el usuario ya escribió (chequear vacío antes de setear).
9. Integrar `VehiclePlateInput` en el campo vehicle_id (reemplaza el input libre),
   pasando `enterpriseId`, `required`, `inputRef` si se usa foco tras reset.

**Verificación:** `npx tsc --noEmit` + `npm run build` (raíz). Reportar. No commit.

---

## Tarea 4 — QuickOpenForm

**Archivo:** `apps/web/src/components/QuickOpenForm.tsx`

1. Reemplazar input vehicle_id por `VehiclePlateInput` (enterpriseId desde redux).
2. Normalizar vehicle_id al construir el evento (`normalizeVehicleId`).
3. Sin más cambios (conserva su validación actual y hardcodes).

**Verificación:** `npx tsc --noEmit`. No commit.

---

## Tarea 5 — Revisión final + build

1. `npm run build` (raíz) + `npx tsc --noEmit`.
2. Revisión spec+calidad de la feature completa (subagente) → corregir hallazgos.
3. Reportar y **pedir permiso de commit** (ojo: también hay sin commitear el trabajo
   previo del cache `dropdownDataSlice` — preguntar si va en el mismo commit).
