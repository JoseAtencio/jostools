# Diseno: Informe mensual (Fase 1 de `docs/new`)

Fecha: 2026-10-08
Estado: aprobado por el usuario
Contexto: ver `docs/new/propuesta-para-jostools.md` y `docs/new/analisis-de-archivos.md`

## Objetivo

Generar automaticamente el informe mensual de mantenimiento (mismo contenido que el PDF "Informe Mensual Septiembre 2026") dentro de JosTools: vista en pantalla + export PDF + export Excel.

## Decisiones del usuario

- Fase inicial: **1 — Informe mensual**
- Salida: **ambos** — ver en pantalla + 2 exports (PDF formato del cliente y Excel)
- Conclusiones: **auto-generadas y editables** antes de exportar
- Graficas en PDF: **html2canvas** (dependencia nueva)
- `fleet_group`: **select con opciones fijas** en el formulario de vehiculos
- `block_reason`: **campo en evento abierto** (detalle y edicion)
- Enfoque tecnico: **A — pagina `/reports` client-side**

## Seccion 1 — Campos de datos nuevos

| Campo | Donde | UI |
|---|---|---|
| `fleet_group` | `vehicles` | Select en `VehicleModal` (alta/edicion): `MQ`, `VP-EP-VB-VC`, `VL-TP`, `Maquinaria`, `Carga pesada`, `Livianos` + opcion de escribir otro; default vacio |
| `observation` | `maintenance_events` | Textarea en `MaintenanceForm` (alta) y `/records/[id]/editar`; visible en el detalle |
| `block_reason` | `maintenance_events` | Select en evento abierto (detalle + edicion): vacio = sin bloqueo, `Falta repuesto`, `Falta de pago`, `Sin disponibilidad del usuario`, `Otro`; se limpia al reabrir; badge en la lista de registros |

Los cambios sobre eventos se registran en `edit_history` (patron existente). `firestore.rules` no cambia.

## Seccion 2 — `reportService` (funciones puras)

Filtrado por mes via `failure_timestamp`:

- Seccion 1: preventivos del mes (tabla)
- Seccion 2: correctivos del mes (tabla con `observation`)
- Distribucion por flota: agrupa por `fleet_group` del catalogo `vehicles`
- Distribucion por sistema: agrupa por `system_category` (existe)
- % preventivo vs correctivo: por `event_type`
- Eficiencia de cierre = cerrados con `workshop_exit_time` en el mes / total en ciclo x 100
- Backlog = eventos abiertos **o** cerrados con `block_reason` no vacio
- Conclusiones: parrafo modelo con valores interpolados, editable en textarea
- Resumen: indicadores existentes (MTTR, MTBF, disponibilidad) del mes

## Seccion 3 — Pagina `/reports` y Navbar

- Entrada Navbar "Informe mensual" (icono documento), entre Registros y Ayuda
- Selector de mes (estilo records) y el informe en orden:
  1. Encabezado (empresa, mes, fecha de generacion)
  2. Resumen del mes (KPIs)
  3. Seccion 1 — Preventivos (tabla)
  4. Seccion 2 — Correctivos (tabla con observacion)
  5. Distribucion por flota + por sistema (tablas/barras)
  6. Backlog (unidades bloqueadas con motivo)
  7. Conclusiones (textarea pre-llenado, editable)
- 2-3 charts recharts en contenedor con fondo blanco (para captura limpia)
- Acciones fijas: `Exportar PDF`, `Exportar Excel`

## Seccion 4 — Exports

- **PDF**: jsPDF vertical A4 + autoTable por seccion; encabezado empresa/mes; graficas rasterizadas con html2canvas. Fallback si el SVG de recharts no captura bien: serializar `<svg>` con XMLSerializer a imagen. Si html2canvas falla, exportar PDF sin graficas (nunca bloquear)
- **Excel** (`xlsx`): hojas `Resumen`, `Preventivos`, `Correctivos`, `Flota`, `Sistema`, `Backlog`
- Instalar html2canvas con `npx npm@10.9.0 install` (no regenerar lockfile con npm 11/12)

## Seccion 5 — Ayuda, errores y verificacion

- Nueva entrada en TOC de `/help` ("Informe mensual") + documentar los 3 campos nuevos
- Mes sin eventos: estado vacio amigable
- Verificacion: `npx tsc --noEmit` + `npm run build`; prueba manual con septiembre 2026 (eventos reales del PDF original) para comparar numeros
