# Reporte detallado de mantenimiento (PDF) - Diseno

Fecha: 2026-10-22
Estado: aprobado por el usuario, en implementacion

## Objetivo

Agregar en `/records` un boton `GENERAR REPORTE` que abra un modal de configuracion de filtros y genere un PDF detallado del periodo seleccionado, con resumen de indicadores, cinco graficas y la tabla completa de eventos.

## Alcance

- PDF unico, generado en el navegador (jspdf + jspdf-autotable + html2canvas, ya instalados).
- Reutiliza `indicatorService` (los cinco `get*Data` y `calculateIndicators`) y los componentes de graficas de `components/charts`.
- No se modifican reglas de Firestore ni se escriben datos nuevos.

## Interfaz

Boton `GENERAR REPORTE` en la barra de filtros de `/records`, junto al selector de mes. Abre `ReportBuilderModal` (`max-w-6xl`) con dos columnas:

- Izquierda (380px, scroll propio): filtros.
- Derecha: vista previa en vivo con KPIs y las cinco graficas.

### Filtros

| Filtro | Control | Origen de datos |
| --- | --- | --- |
| Periodo | `date` desde / hasta + presets (mes actual, mes anterior, ultimos 3 meses, este ano, todo) | fechas de falla del evento |
| Vehiculos | multi-select con buscador (placa, codigo, marca, modelo) | catalogo de vehiculos |
| Tipo de evento | checkboxes Correctivo, Preventivo, Inspeccion, Predictivo | `types/maintenance` |
| Estado | checkboxes Abierto, Cerrado, Bloqueado | `status` y `block_reason` |
| Sistema | multi-select con buscador | categorias grupo `system_category` |
| Componente | multi-select con buscador | categorias grupo `component` |
| Causa raiz | multi-select con buscador | categorias grupo `root_cause` |
| Grupo de flota | multi-select | `fleet_group` de los vehiculos |

Reglas:

- Un filtro con la lista vacia significa "sin restriction" (todos).
- El rango de fechas se aplica sobre `failure_timestamp`.
- Estado: un evento con `block_reason` coincide con "Bloqueado" y tambien con "Abierto" si sigue pendiente; "Cerrado" exige `status === COMPLETED`.
- Boton `Limpiar filtros` restablece el estado inicial (periodo: todo).

## Vista previa

- KPIs: total de eventos, correctivos, preventivos, cerrados, MTBF, MTTR, disponibilidad, costo total.
- Graficas: pie por tipo de evento, barras por mes, linea MTBF/MTTR, costo por sistema, top vehiculos con mas eventos.
- Sin eventos filtrados se muestra "Sin datos para los filtros seleccionados".

## PDF

`detailedReportExportService.exportDetailedReport(...)`. Diseno visual: fondo blanco, encabezado oscuro con banda de acento, tablas lineales y pie de pagina en todas las hojas.

1. Pagina 1 (vertical): fondo blanco, titulo, periodo, fecha de generacion y total de eventos; linea de acento; "Resumen del periodo" con retícula de 8 indicadores (eventos, MTBF, MTTR, MTTF, disponibilidad, horas de taller, costo total, costo promedio) y sus pistas; "Composicion de los eventos" con dos lineas de reparto (por tipo y por estado); y "Conclusiones" automaticas. No se imprimen los filtros aplicados.
2. Pagina 2 (vertical): "Graficas del periodo" con las cuatro graficas (tipo de evento, eventos por mes, tendencia MTBF/MTTR, costos por categoria) capturadas en un solo bloque 2x2. Cada grafica lleva debajo su linea de explicacion.
3. Pagina 3 (vertical): "Vehiculos con mas eventos" (grafica) y tres tablas resumen (por sistema, por vehiculo, causas y componentes mas frecuentes, 6 filas cada una).
4. Pagina 4 (vertical): "Glosario". Indicadores (MTBF, MTTR, MTTF, Disponibilidad) con su valor del periodo, que datos del registro usa cada calculo (tabla de 10 filas) y como leer cada grafica.
5. Pagina 5 en adelante (horizontal): titulo sobre fondo blanco y tabla de detalle de los eventos con 12 columnas, con encabezado repetido en cada hoja.
6. Pie de pagina en todas las hojas: "JosTools - Reporte de mantenimiento" y "Pagina X de Y".

El PDF es para imprimir: sin fondos oscuros (banda negra del encabezado ni cabeceras de tabla en negro), solo texto gris oscuro, tablas con fondo gris muy claro y una linea de acento amarilla.

Las graficas del PDF se generan en un area de impresion oculta (960 px, fondo blanco, fuera de pantalla) con la version clara de los componentes Recharts, para que no dependan del scroll de la vista previa y se capturen completas. Los charts aceptan `theme="light"` (fondo blanco, ejes y textos oscuros, paleta de mayor contraste), `static` (sin animacion) y `subtitle` (linea de explicacion bajo el titulo). Las descripciones viven en `apps/web/src/lib/chartDescriptions.ts` y se reutilizan en el dashboard, en la vista previa del reporte y en el PDF.

Nombre del archivo: `Reporte_Mantenimiento_YYYY-MM-DD.pdf`.

## Archivos

Nuevos:

- `apps/web/src/lib/services/detailedReportService.ts`: tipos de filtro, aplicacion de filtros, resumen y etiquetas legibles.
- `apps/web/src/lib/services/detailedReportExportService.ts`: generacion del PDF.
- `apps/web/src/components/MultiSelectFilter.tsx`: lista con buscador y checkboxes, reutilizable.
- `apps/web/src/components/ReportBuilderModal.tsx`: modal de filtros y vista previa.

Modificados:

- `apps/web/src/app/records/page.tsx`: boton y montaje del modal.

## Fix de NaN en los indicadores

`calculateIndicators` sumaba `salida - falla` para todos los correctivos, incluso los que siguen abiertos: `new Date("")` es `NaN` y contaminaba todo el promedio, dejando `mttr = NaN` (que se imprimia como "NaN h" porque `NaN != null`) y `mtbf = null` aunque hubiera correctivos cerrados.

Correccion en `indicatorService`:
- `hoursBetween` devuelve `NaN` de forma explicita si alguna fecha no es valida.
- El MTTR se promedia solo sobre correctivos con salida registrada; si no hay ninguno, queda `null` y se muestra "--".
- La inactividad acumulada del MTBF usa solo los correctivos medibles, asi que el MTBF si se calcula cuando hay correctivos cerrados.
- `getMTBFMTTRTrend` aplica la misma regla.
- Se agrega `formatIndicator(valor, sufijo)` que nunca imprime `NaN` y se usa en el PDF detallado, el modal del reporte, el PDF mensual, el Excel de eventos y la vista de informes.

- `html2canvas` requiere que las graficas esten montadas y con tamano: el area de impresion oculta cumple ambas condiciones (tiene layout, no usa `display:none`).
- Los identificadores de html2canvas no admiten caracteres especiales fuera del rango latin1: el texto del PDF pasa por `safeText`, que quita diacriticos y caracteres no soportados.
- Mezclar orientaciones en jsPDF se hace con `addPage("a4", "landscape")`; la tabla de detalle queda al final para no volver a vertical. El pie de pagina lee `doc.internal.pageSize` de cada pagina, asi que respeta la orientacion real.
- Si las tablas resumen de la pagina 3 se desbordan, `autoTable` genera una hoja extra: por eso cada tabla se limita a 6 filas.
