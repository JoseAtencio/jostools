# Propuesta: aplicar los procesos de `docs/new` en JosTools

Objetivo: automatizar los 6 procesos identificados en el analisis (informe mensual, kardex de gasoil, kardex de lubricantes, backlog, eficiencia de cierre, distribucion por flota) dentro del sistema.

---

## 1. Otra app o dentro de JosTools?

| Opcion | Pros | Contras |
|---|---|---|
| **A. App aparte** (inventario/gestion documental nueva) | Dominio "puro" de kardex | Duplica login, multi-empresa, catalogo de vehiculos, permisos, hosting, CI/CD y componentes UI. El informe mensual **no puede** vivir ahi porque necesita `maintenance_events` |
| **B. Dentro de JosTools (recomendado)** | Reutiliza todo lo existente: Google auth, reglas por empresa, catalogo de vehiculos, Navbar/AuthGuard, filtros, exportadores (Excel/PDF con jspdf ya instalado), indicadores. Las matriculas son las mismas. Un solo deploy (ya funcionando en Vercel) | El sistema crece en alcance (mas modulos que mantener) |
| **C. Hibridda** (hoy B, despues extraer) | Conserva la puerta de salida: si algun dia se quiere vender el kardex solo, se extrae a `apps/` del mismo workspace | Solo vale si realmente se va a vender aparte |

**Conclusion:** **Opcion B**. Todo va dentro de JosTools como modulos nuevos junto a Dashboard/Registros. No hay caso de negocio para una segunda app: comparten exactamente los mismos usuarios, empresa, vehiculos y periodo mensual. Ademas, el propio informe (P1) exige los eventos de mantenimiento, asi que separarlo seria imposible sin duplicar la base de datos.

---

## 2. Mapa documento → modulo

| Archivo de `docs/new` | Proceso | Modulo propuesto en JosTools |
|---|---|---|
| Informe mensual PDF | P1, P4, P5, P6 | **/reports → Generador de informe mensual** |
| CONTROL DE GASOIL.xlsx | P2 | **/combustible → Kardex de gasoil** |
| CAM-FR-AD-012 Lubricantes | P3 | **/inventario → Kardex de lubricantes y repuestos** |

---

## 2.1 Analisis profundo de los Excel: mapeo columna por columna → JosTools

**Veredicto: todo esta relacionado.** Los 3 archivos son piezas del mismo ciclo operativo de la misma empresa y la misma flota: (1) ocurren mantenimientos y consumos, (2) se registran en kardex, (3) a fin de mes se compila el informe. **No corresponde un sistema aparte.**

### Confirmacion de las formulas reales (extraidas de los archivos)

- Lubricantes: `EXISTENCIA(n) = EXISTENCIA(n-1) + CANTIDAD(entrada) - CANTIDAD2(salida)`, con saldo inicial por hoja (SAE 50: 10, GEAR: 75, GRASA: 30) → **kardex clasico: la app solo debe arrastrar el saldo**.
- Gasoil planta: `litros = toneladas x T/L (1.5)`.
- Cierre gasoil: `existencia final = existencia previa (21,341) + ingresos (17,432) - consumo (23,946)`, donde `consumo = interno (5,560) + planta (2,513) + sindicato (1,488) + ZU-CONCRETO (14,385)`.
- Totales por hoja: simples `SUM(...)` → calculos 100% automatizables.

### Mapeo de columnas

| Archivo / hoja | Columna Excel | Equivalente en JosTools hoy | Aplica? |
|---|---|---|---|
| Gasoil INTERNO | FECHA | mismo tipo fecha de eventos | ✅ directo |
| | Operacion (EGRESO/INGRESO) | nuevo campo `tipo movimiento` | ✅ modulo kardex |
| | EMPRESA (CARGO 815, VISION, MOPARCA...) | **catalogo `vehicles` — misma flota** | ✅ vinculo directo |
| | VEHICULO (PROPIO/APOYO) | catalogo | ✅ |
| | OBRA (PATIO...) | no existe campo obra | ➕ campo nuevo |
| | CANTIDAD DE LITROS | no existe (no es mantenimiento) | ➕ en modulo kardex |
| | SOPORTE (Nro factura) | no existe | ➕ texto libre |
| | Quien reporta | `user` de Firebase Auth | ✅ automatico |
| Gasoil PLANTA | TONELADAS, T/L, litros calculados | no existe | ➕ formula (litros = ton x T/L) |
| | OBRA (ASFALTADO INTERNO CAMELOT) | no existe | ➕ campo obra |
| Gasoil SINDICATO | CHOFER, C.I., SINDICATO, PLACAS | **personas externas al sistema** | ⚠️ texto libre, NO justifica sistema aparte |
| Gasoil ZU-CONCRETO | Placa de terceros, talonario | fuera del catalogo | ⚠️ texto libre |
| Gasoil INGRESOS | Proveedor, Nro Control/Factura, litros | no existe | ➕ entrada del kardex |
| Lubricantes | PROVEEDOR / FECHA / CANTIDAD | no existe | ➕ entrada kardex |
| | EQUIPO (RETRO 420D, CARGO 815...) | **catalogo `vehicles` — misma flota** | ✅ vinculo directo |
| | NOTA DE ENTREGA | no existe | ➕ texto libre |
| | EXISTENCIA (saldo corrido) | se calcula solo | ✅ automatico |
| Informe PDF | Tipo de intervencion | `event_type` | ✅ ya existe |
| | Sistema afectado | `system_affected` | ✅ ya existe |
| | Matricula / prefijo (MQ, VP, VL) | `vehicle_id` + **`fleet_group` nuevo** | ✅ +1 campo |
| | Observacion/pendiente, backlog | no existe | ➕ 2 campos en evento |
| | Eficiencia de cierre, % | derivados de fechas/estado | ✅ automatico |

### Conclusion de la revision

1. **Todo va dentro de JosTools** (informe + gasoil + lubricantes), compartiendo: auth, multi-empresa, **catalogo de vehiculos (las mismas matriculas)**, Navbar/AuthGuard, filtros y exportadores.
2. **Lo unico no relacionado** (choferes de sindicato, placas de terceros, facturas/proveedores) se resuelve con **texto libre** en los movimientos — no justifica catalogo nuevo ni sistema aparte.
3. **Faltantes en JosTools hoy:** campo `obra`, campos de kardex (litros/toneladas/soporte), y del informe: `fleet_group` (vehiculo), `observation` + `block_reason` (evento).
4. **Ganancia directa:** cruzar salidas de gasoil/lubricante del vehiculo con su odometro y eventos da indicadores nuevos gratis (km/L, costo por km, consumo anormal en inyeccion) — solo posible porque todo vive en el mismo sistema.

---

## 3. Modulo 1: Informe mensual (el quick win)

**Por que primero:** los datos ya existen en `maintenance_events`. Solo hace falta agregar 2-3 campos y la vista.

### Flujo

1. Navbar → "Informe mensual" → selector de mes (ej: Septiembre 2026).
2. El sistema agrega automaticamente todo lo que hoy se hace a mano:
   - Lista de correctivos y preventivos con observaciones (seccion 1 y 2 del PDF).
   - Distribucion por tipo de flota (necesita campo nuevo, ver abajo).
   - Distribucion por sistema afectado (ya existe `sistema_afectado`).
   - % preventivo vs correctivo (ya existe `event_type`).
   - **Eficiencia de cierre** = cerrados en el mes / total en ciclo x 100.
   - **Backlog** = eventos abiertos o cerrados con `motivo_bloqueo` distinto de nulo.
   - Conclusiones/redaccion generada a partir de esos numeros (texto modelo con valores interpolados).
3. Salida: vista en pantalla + **Exportar PDF** (jspdf + autotable, ya usado en `pdfExportService`) con las graficas del dashboard renderizadas a imagen, o **Exportar Excel**.

### Cambios de datos requeridos (fase corta)

| Campo nuevo | Donde | Para que |
|---|---|---|
| `fleet_group` (MQ / VP-EP-VB-VC / VL-TP, o "Maquinaria", "Carga pesada", "Livianos") | catalogo de vehiculos | distribucion por tipo de flota (P6) |
| `observation` (obs/pendiente, ej: "Faltan tapas del eje muerto") | maintenance_events | seccion "observaciones" del informe |
| `block_reason` (ej: falta repuesto, falta de pago, sin disponibilidad del usuario, nulo = sin bloqueo) | maintenance_events | indicador de backlog (P4) |

Nada mas: horas, costos, fechas, tipos, sistemas y estados ya estan.

---

## 4. Modulo 2: Kardex de combustible (`/combustible`)

Reemplaza `CONTROL DE GASOIL.xlsx` manteniendo su logica:

- **Movimientos** (coleccion nueva por empresa): `fecha`, `tipo` (entrada|salida), `categoria` (interno | planta | sindicato | tercero), `vehicle_id` (referencia al catalogo, opcional), `obra`, `litros`, `proveedor`, `factura/soporte`, `toneladas` + `t_l` (para planta, calcula litros), `nota_entrega`.
- **Pantalla:** tabla con filtros de mes/categoria/vehiculo, alta rapida de movimiento, y **saldo de existencia calculado automaticamente** (se acaba el arrastre manual de columna).
- **Cierre mensual automatico:** boton "Cierre de septiembre" que calcula totales por categoria (interno, planta, sindicato, terceros, ingresos) y balance global — lo que hoy se suma a mano en las 5 hojas.
- **Consumo por vehiculo:** agrupando salidas por `vehicle_id` se obtiene litros/vehiculo/mes; cruzado con el odometro del proximo evento de mantenimiento da km/L y deteccion de consumo anormal (el vehiculo que mas gasta).
- **Alertas:** existencia baja (stock minimo configurable) — responde a la recomendacion "stock minimo de repuestos" del informe.
- **Importador Excel (script/admin):** parsear los cierres historicos con la libreria `xlsx` (npm) para cargar los meses previos y no arrancar de cero.

## 5. Modulo 3: Kardex de lubricantes y repuestos (`/inventario`)

Mismo patron que el gasoil (es el mismo kardex, otro catalogo):

- **Items** por tipo de fluido: `15W-40`, `SAE 50`, `GEAR 85W-140`, `GRASA LITHIUM 15 KG` (catalogo configurable por empresa, igual que categorias hoy).
- **Movimientos:** entrada (proveedor, cantidad) / salida (equipo, nota de entrega) con **existencia corrida calculada**.
- Los mismos alertas de stock bajo y cierre mensual.
- Extensible a **repuestos** despues (mismo modulo, nuevos items) — directamente ataca la recomendacion "bombines, valvulina, tapas de eje" del informe.

---

## 6. Modelo de datos (Firestore)

Respetando la estructura actual (`jostools/...` por empresa y las mismas reglas de membresia que `maintenance_events`):

```
jostools/.../maintenance_events  (+ observation, block_reason)     # P1, P4
jostools/.../vehicles            (+ fleet_group)                   # P6
jostools/.../fuel_movements      # nuevo: kardex gasoil            # P2
jostools/.../stock_items         # nuevo: fluidos/repuestos        # P3
jostools/.../stock_movements     # nuevo: entradas/salidas item    # P3
```

Permisos: mismas reglas de empresa (miembros leen/escriben, solo miembros). No se necesita nada nuevo de infraestructura: mismo Firebase, mismo hosting Vercel.

---

## 7. Fases sugeridas

| Fase | Que | Esfuerzo |
|---|---|---|
| **1** | Informe mensual: +3 campos, pagina `/reports`, calculos, export PDF/Excel | Chico — reutiliza eventos, KPIs y exportadores ya escritos |
| **2** | Kardex de gasoil: coleccion, pantalla, saldo y cierre automatico | Medio |
| **3** | Kardex de lubricantes (reutiliza todo lo de gasoil parametrizado por item) | Chico si la fase 2 fue generica |
| **4** | Importador historico de Excel + alertas de stock + consumo por vehiculo | Medio |

## 8. Riesgos / decisiones pendientes

1. **Graficas en el PDF:** hay que rasterizar las graficas del dashboard (html2canvas o re-dibujarlas con jspdf) — decidir en la fase 1.
2. **Catalogo de la flota real:** el informe usa 27+ unidades con prefijos; hay que cargar/verificar `fleet_group` en los vehiculos existentes.
3. **Texto de conclusiones:** proponer 2-3 modelos de redaccion automatica para que suene al informe actual (se puede refinar con el real).
4. **Formatos CAM-FR-AD-002/012:** si el cliente exige conservar el formato exacto de Excel, se puede exportar el cierre con esas mismas hojas (sheetjs) en vez de rediseñar.
