# Diseno: Kardex de gasoil (Fase 2)

Fecha: 2026-10-08
Estado: aprobado por el usuario
Sustituye el Excel `CONTROL DE GASOIL.xlsx` (formato CAM-FR-AD-002).

## Decisiones del usuario

| Tema | Decision |
|---|---|
| Saldo inicial | Config por empresa: doc de config con `fuel_config.initial_liters`, editable desde `/combustible` |
| Exports | Excel (hojas por categoria + cierre) y PDF resumen del cierre |
| Cierre mensual | Computado al vuelo, sin snapshot persistido; se recalcula si cambian movimientos |
| Formulario | Campos condicionales por categoria (como las hojas del Excel) |
| Permisos | Igual que eventos: cualquier miembro crea/edita/borra |
| Alcance | Kardex puro; importador historico, alertas de stock y km/L quedan para Fase 4 |

## Enfoque elegido

Kardex directo estilo `/records`: pagina client-side que carga los movimientos de la empresa y filtra en memoria. Helpers puros de saldo/cierre en el service (reutilizables en Fase 3). Sin paginacion server-side (volumen real ~40-80 filas/mes).

## Modelo de datos

### `fuel_movements` (nueva, misma estructura por empresa que `maintenance_events`)

- `enterprise_id`, `fecha` (ISO), `tipo` (`"entrada" | "salida"`)
- `categoria`: `"interno" | "planta" | "sindicato" | "tercero" | "compra"`
  - `compra` solo con tipo entrada; `interno`/`planta`/`sindicato`/`tercero` solo con tipo salida (la UI lo deduce de la categoria)
- `vehicle_id` (opcional, catalogo existente; categoria interno), `obra`, `litros` (number)
- Planta: `toneladas` + `t_l` (factor, default 1.5); `litros` guarda toneladas x t_l calculado
- Campos condicionales:
  - sindicato: `chofer`, `ci`, `placa`
  - tercero: `placa`, `talonario`
  - compra: `proveedor`, `nro_control`, `nro_factura`
  - interno: `soporte` (nro factura)
  - todos: `nota` opcional
- `created_by`, `created_at`, `updated_at`

### Config de empresa

Doc `jostools/config/{enterpriseId}` (patron de `config/users`): campo `fuel_config: { initial_liters: number }`. Edicion desde un engranaje en `/combustible`.

## Pantalla `/combustible`

- Navbar: link "Combustible" despues de "Informe mensual"
- KPIs: existencia actual (saldo inicial + ingresos - egresos), ingresos del mes, consumo del mes, litros/dia
- Seccion "Cierre de <mes>": totales por categoria + ecuacion `previa + ingresos - consumo = existencia`; badge de cuadre
- Filtros: mes, categoria, vehiculo
- Tabla: fecha, tipo, categoria, vehiculo/destino, obra, litros, soporte; click en fila = editar; boton borrar con confirmacion
- Modal de alta/edicion (patron MaintenanceForm): campos condicionales por categoria; planta calcula litros en vivo
- Ayuda en `/help` (seccion "combustible")

## Logica (helpers puros en `fuelKardexService.ts`)

- `balanceOf(movements, initialLiters)` -> `{ existencia, ingresos, consumo, dias }`
- `cierreOf(movements, initialLiters, monthKey)` -> totales por categoria + balance del mes; la "previa" del mes es la existencia antes del primer movimiento del mes (incluye movimientos anteriores), asi el cierre de un mes viejo es correcto
- litros/dia = consumo del mes / dias transcurridos (o dias del mes si ya paso)
- Existencia negativa se muestra (badge rojo), no bloqueia nada

## Exports

- Excel (`fuelExportService`, sheetjs): hoja "Cierre" (totales + balance), "Interno", "Planta" (toneladas, T/L, litros), "Sindicato", "Terceros", "Ingresos" — columnas iguales al CONTROL DE GASOIL
- PDF resumen (jspdf + autotable, patron `pdfExportService`): encabezado JosTools + mes, tabla de cierre con balance, tabla de movimientos del mes

## Casos borde

- Borrar: confirmacion, recalculo instantaneo
- Editar: modal en modo edicion; planta recalcula litros
- Mes sin movimientos: KPIs en 0, cierre muestra previa
- Migracion: cargar existencia previa del ultimo cierre Excel en el config (una vez); importador historico = Fase 4

## Fuera de alcance (Fase 4)

Importador de Excel historico, alerta de stock minimo, consumo por vehiculo / km/L.

## Verificacion

tsc + build; prueba manual: alta por cada categoria, planta con toneladas, saldo cuadrado contra el Excel de septiembre (21,341 + 17,432 - 23,946 = 14,827).
