# Analisis de los archivos de `docs/new`

Carpeta analizada: `docs/new/` (3 archivos). Corresponden a documentos operativos reales de la empresa de construccion vial/asfalto (flota de camiones, maquinaria pesada y planta de asfalto), elaborados manualmente en Excel y consolidados en un PDF mensual para el cliente.

---

## 1. `Informe Mensual Septiembre 2026 de Mantenimiento e Infraestructura..pdf`

**Que es:** Reporte mensual de mantenimiento y operaciones (8 paginas) dirigido al cliente. Es el deliverable final de un proceso que se hace cada mes.

### Estructura y contenido

| Seccion | Contenido |
|---|---|
| 1. Correctivos y equipos reparados | Lista de ~19 intervenciones con matricula del equipo, que se hizo y observacion/pendiente (ej: "Faltan tapas del eje muerto", "Pendiente completar de valvulina") |
| 2. Preventivos | 4 rutinas preventivas (Payloader 928, Cargo 815 x2, control general de patio) |
| 3. Trabajos en planta de asfalto | Reparacion de exhaustor, estructura/chimenea |
| 4. Gestion administrativa | Control de flota, documentacion legal, inspecciones por unidad, plan preventivo, desarrollo de software de KPIs (el propio JosTools) |
| 5. Estatus de unidades | A) Por culminar en taller B) Proximos ingresos a taller |
| 6. Distribucion por tipo de flota | 27 intervenciones clasificadas por prefijo: MQ (25.9%), VP/EP/VB/VC carga pesada (59.3%), VL/TP livianos (14.8%) |
| 7. Indicador de backlog | 5 de 22 unidades (22.7%) detenidas por cuellos de botella administrativos/logisticos (falta repuesto, falta de pago, falta de disponibilidad del usuario) |
| 8. Tasa de cumplimiento | Indice de eficiencia de cierre = 22 completados / 27 en ciclo = **81.5%** |
| 9. Analisis por sistemas afectados | Frenos/embrague 7, inyeccion/combustible 4, hidraulico 3, electrico 2 |
| 10. Resumen estadistico | Preventivos 4 (15.4%), correctivos 22 (84.6%), mecanicos 87%, electricos 13% |
| 11. Conclusiones y recomendaciones | Subir preventivos al 40-50%, stock minimo de repuestos, agilizar cierres financieros |
| Graficas | Paginas con imagenes de distribucion de intervenciones (barras/pastel) |

### Proceso manual que representa

1. Durante el mes se van registrando las intervenciones (hoja mental o notas; hoy tambien en JosTools).
2. A fin de mes alguien compila: lista de equipos, clasifica por tipo de flota y por sistema, cuenta y calcula porcentajes.
3. Calcula indicadores ad-hoc: eficiencia de cierre, backlog (unidades frenadas por motivos no tecnicos).
4. Redacta conclusiones y recomendaciones.
5. Consolida en Word/PDF con graficas y lo entrega al cliente.

**Frecuencia:** mensual. **Dato fuente principal:** los eventos de mantenimiento del mes + estado de las unidades en taller.

---

## 2. `CONTROL DE GASOIL.xlsx` (formato CAM-FR-AD-002)

**Que es:** Kardex (control de entradas y salidas) de combustible diésel, 5 hojas, un formato oficial de la empresa con codigo de formulario y paginacion.

### Hojas y columnas

| Hoja | Flujo | Columnas clave | Cierre del mes |
|---|---|---|---|
| CONTROL GASOIL INTERNO | EGRESOS a la flota propia/obra | Fecha, Operacion, Reporta, Empresa/vehiculo, Observaciones, Vehiculo, Obra, Litros, Soporte (Nro factura) | 5,560 L |
| GASOIL DESPACHO DE PLANTA | Despachos a la planta de asfalto | Toneladas, T/L (factor 1.5), Obra, Litros = Toneladas x T/L | 2,513 L |
| VOLTEO SINDICATO | Entrega a choferes de sindicato | Chofer, C.I., Sindicato, Nro Factura, Placas, Litros | 1,488 L |
| CONTROL GASOIL ZU-CONCRETO | Entrega a empresa externa | Placa, Litros, Soporte, Nro Talonario | 14,385 L |
| CONTROL INGRESO GASOIL | COMPRAS/ingresos | Proveedor, Nro Control, Nro Factura, Litros | 17,432 L |

### Calculos que hace

- Despacho de planta: `litros = toneladas x T/L` (formula derivada en la hoja).
- Balances de cierre por hoja ("CIERRE DEL 01/09 AL 30/09" + total).
- Balance global de existencias: `ultimo cierre + entradas - consumo = existente` (21,341 + 17,432 - 23,946 ...).

### Proceso manual que representa

1. Quien reporta (ej: JESUS ROMERO) anota cada carga: fecha, a quien/que vehiculo u obra, litros, factura/soporte.
2. Se separa por tipo de egreso (interno, planta, sindicato, terceros) y por compra.
3. A fin de mes se suman por hoja y se recalcula la existencia global.
4. Se imprime/guarda como formato controlado (CAM-FR-AD-002).

**Frecuencia:** diaria de registro, cierre mensual.

---

## 3. `CAM-FR-AD-012 RELACION DE CONSUMO DE LUBRICANTE.xlsx`

**Que es:** Kardex de consumo de lubricantes/grasas por tipo de fluido, 4 hojas (formato CAM-FR-AD-012):

- Hojas: `15W-40`, `SAE 50`, `GEAR 85W-140`, `GRASA LITHIUM 15 KG`
- Columnas: **ENTRADA** (Fecha, Proveedor, Cantidad) y **SALIDA** (Solicitante, Equipo, Cantidad, Nro Nota de entrega) + **EXISTENCIA** (saldo corrido)

### Proceso manual que representa

1. Compras al proveedor (ENVISERCA) = entradas que suman existencia.
2. Cada entrega a un equipo u obra = salida que resta, con nota de entrega.
3. La existencia se arrastra fila a fila (saldo corrido) y se cierra el mes.
4. Un formato por cada tipo de fluido.

**Frecuencia:** continua de registro, cierre mensual. **Mismo patron que el gasoil**: kardex entrada/salida con saldo.

---

## Patrones comunes a los 3 archivos

1. **Mismo universo de datos:** las matriculas del PDF (VP 6-004, MQ 23-014, TP 11-001...) y de los Excel (CARGO 815, RETRO 420D, CARGADOR 928G) son la **misma flota que ya vive en JosTools**.
2. **Periodo mensual:** los tres se cierran por mes ("CIERRE DEL 01/09 AL 30/09").
3. **Procesos repetitivos y mecanicos:** clasificar, contar, sumar, sacar porcentajes, arrastrar saldo, redactar conclusiones.
4. **Formatos controlados con codigo:** CAM-FR-AD-002, CAM-FR-AD-010/012 (formatos normalizados de gestion documental).
5. **Cuellos de botella no capturados:** el informe reporta unidades frenadas por motivos administrativos (falta repuesto/pago/disponibilidad) — dato que JosTools **no** guarda hoy.
6. **Clasificaciones que JosTools ya tiene o se le parecen:** tipo de intervencion (correctivo/preventivo), sistema afectado (frenos, inyeccion, hidraulico...), y una "categoriza de flota" por prefijo que hoy no existe como campo.

## Procesos identificados para automatizar

| # | Proceso actual | Donde ocurre hoy | Automatizable |
|---|---|---|---|
| P1 | Informe mensual de mantenimiento (recopilar, clasificar, calcular %, redactar, graficar, PDF) | Word/Excel manual + PDF | **Si, casi total** — JosTools ya tiene los eventos, tipos, sistemas y KPIs |
| P2 | Kardex de gasoil (entradas/salidas/balance por mes) | Excel manual | **Si** — modulo nuevo de kardex con calculo automatico |
| P3 | Kardex de lubricantes (saldo corrido por fluido) | Excel manual | **Si** — mismo patron de kardex que P2 |
| P4 | Indice de backlog / unidades frenadas por motivos administrativos | Conteo manual dentro del informe | **Si** — requiere 1 campo nuevo en el evento (motivo de bloqueo) |
| P5 | Eficiencia de cierre del mes (completados/total ciclo) | Calculo manual | **Si** — derivable de fechas de los eventos |
| P6 | Distribucion por tipo de flota por prefijo | Clasificacion manual | **Si** — requiere campo "grupo de flota" en el vehiculo |
