# JosTools

Monorepo de herramientas web para gestión de mantenimiento de flotas vehiculares.

## Stack

- **Monorepo**: npm workspaces
- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Backend**: Firebase (Authentication + Firestore)
- **Paquetes compartidos**: `@jostools/firebase-config`

## Estructura

```
jostools/
├── apps/
│   └── web/                  # Next.js app
│       ├── src/app/          # App Router pages
│       └── src/lib/          # Utilities (firebase.ts)
├── packages/
│   └── firebase-config/      # Config compartida de Firebase
└── docs/plans/               # Documentación del proyecto
```

## Inicio Rápido

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build producción
npm run build

# Lint
npm run lint
```

## Variables de Entorno

Crea `apps/web/.env.local` con tus credenciales de Firebase:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

---

# Especificación Técnica de Indicadores de Mantenimiento de Flotas (MTBF, MTTR, MTTF)

## 1. Introducción y Contexto del Estándar

El presente documento define los lineamientos, fórmulas, estructuras de datos y lógica de integración para el cálculo automatizado de los indicadores clave de mantenimiento de flotas vehicular (**MTBF**, **MTTR**, **MTTF**) y el indicador global de **Disponibilidad Operativa**.

Este estándar técnico sirve como directriz de arquitectura e implementación para agentes inteligentes de desarrollo, desarrolladores backend/frontend, diseñadores de bases de datos e ingenieros de mantenimiento de software.

---

## 2. Definiciones Teóricas y Fórmulas Matemáticas

### 2.1 MTBF (Mean Time Between Failures / Tiempo Medio Entre Fallas)

- **Definición**: Medida de la confiabilidad de un activo o sistema reparable. Indica la cantidad promedio de tiempo (u horas de operación / kilometraje) que transcurre entre dos fallas imprevistas consecutivas.
- **Aplica a**: Vehículos completos, subsistemas y activos reparables (Motor, Transmisión, Sistema de Frenos, Dirección, Compresor de Aire).
- **Fórmula Matemática**:

$$\text{MTBF} = \frac{\text{Tiempo Total de Operación} - \text{Tiempo Total de Inactividad por Falla Correctiva}}{\text{Número Total de Fallas Correctivas (N)}}$$

Para flotas vehiculares orientadas a distancia recorrida:

$$\text{MTBF}_{\text{km}} = \frac{\text{Kilometraje Total Recorrido en el Periodo}}{\text{Número Total de Eventos Correctivos en el Periodo}}$$

---

### 2.2 MTTR (Mean Time To Repair / Tiempo Medio de Reparación)

- **Definición**: Medida de la mantenibilidad y eficiencia del proceso de taller. Representa el tiempo promedio requerido para diagnosticar, reparar y restituir un activo a su estado operativo tras una falla imprevista.
- **Aplica a**: Procesos de mantenimiento correctivo del taller.
- **Fórmula Matemática**:

$$\text{MTTR} = \frac{\sum_{i=1}^{N} \text{Tiempo Total de Reparación del Evento } i}{\text{Número Total de Eventos Correctivos (N)}}$$

$$\text{Tiempo de Reparación (Downtime Total)} = \text{Fecha/Hora Fin Reparación} - \text{Fecha/Hora Reporte Falla}$$

*Nota de implementación*: Se recomienda calcular adicionalmente el **MTTR Efectivo** (Horas/Hombre dedicadas) separándolo de la **Espera Logística** (espera de repuestos o cola de taller).

---

### 2.3 MTTF (Mean Time To Failure / Tiempo Medio Hasta la Falla)

- **Definición**: Medida de la durabilidad o vida útil esperada de componentes no reparables (piezas consumibles o reemplazables que se desechan al fallar).
- **Aplica a**: Neumáticos, Baterías, Filtros, Bombillas, Fusibles, Discos/Pastillas de freno, Correas/Bandas.
- **Fórmula Matemática**:

$$\text{MTTF} = \frac{\sum_{j=1}^{M} \text{Uso Total de la Pieza } j \text{ Hasta su Falla}}{\text{Número Total de Unidades Desechadas por Falla (M)}}$$

---

### 2.4 Disponibilidad Operativa (A)

- **Definición**: Porcentaje del tiempo total planificado en el que un vehículo está disponible para prestar servicio en ruta.
- **Fórmula Matemática**:

$$A = \left( \frac{\text{MTBF}}{\text{MTBF} + \text{MTTR}} \right) \times 100$$

---

## 3. Arquitectura del Formulario Digital de Mantenimiento

Para capturar de forma limpia y consistente los datos requeridos sin sobrecargar al operador o mecánico, la entrada de datos debe estructurarse mediante un formulario digital validado.

### 3.1 Estructura de Parámetros y Tipos de Datos

| Nombre del Campo | Nombre en BD (`snake_case`) | Tipo de Dato | Requerido | Descripción / Opciones |
| :--- | :--- | :--- | :--- | :--- |
| **ID del Reporte** | `id` | `UUID` / `BIGINT` | Sí | Clave primaria del evento de taller. |
| **ID del Vehículo** | `vehicle_id` | `UUID` / `VARCHAR` | Sí | Placa, VIN o Ficha técnica del vehículo. |
| **Odómetro / Horas** | `current_odometer` | `DECIMAL(10,2)` | Sí | Kilometraje o horas motor al ingresar al taller. |
| **Tipo de Evento** | `event_type` | `ENUM` | Sí | `CORRECTIVE` (Falla imprevista), `PREVENTIVE` (Mantenimiento programado), `INSPECTION`. |
| **Fecha/Hora de Falla** | `failure_timestamp` | `TIMESTAMPTZ` | Sí | Momento exacto en que ocurrió o se reportó la falla. |
| **Fecha/Hora Entrada Taller**| `workshop_entry_time`| `TIMESTAMPTZ` | Sí | Momento en que la unidad ingresa a las instalaciones. |
| **Fecha/Hora Salida Taller** | `workshop_exit_time` | `TIMESTAMPTZ` | Sí | Momento en que la unidad recibe el alta y está disponible. |
| **Horas Hombre Efectivas** | `effective_work_hours` | `DECIMAL(5,2)` | No | Horas reales invertidas por los mecánicos en la reparación. |
| **Sistema Afectado** | `system_category` | `ENUM` | Sí | `ENGINE`, `TRANSMISSION`, `BRAKES`, `ELECTRICAL`, `TIRES`, `SUSPENSION`, `OTHER`. |
| **Componente Específico** | `component_id` | `VARCHAR` | Sí | Pieza o subsistema intervenido (ej: `ALT-001` - Alternador). |
| **Acción Realizada** | `action_taken` | `ENUM` | Sí | `REPAIRED` (Se repara pieza existente), `REPLACED` (Se instala pieza nueva/desecho), `ADJUSTED`. |
| **Causa Raíz** | `root_cause` | `ENUM` | No | `WEAR_AND_TEAR` (Desgaste natural), `OPERATOR_ERROR` (Manejo), `PART_DEFECT` (Defecto de repuesto), `ACCIDENT`. |
| **Costo Total Reparación** | `repair_cost` | `DECIMAL(12,2)` | No | Suma de repuestos y mano de obra. |

---

## 4. Lógica de Filtrado y Reglas de Negocio para Algoritmos

Al implementar los algoritmos de procesamiento para generar los dashboards y reportes, se deben aplicar estrictamente las siguientes reglas:

1. **Exclusión de Mantenimientos Preventivos en MTBF**:
   - Los registros donde `event_type == 'PREVENTIVE'` **NO** deben sumarse como falla en el denominador del MTBF.
   - El kilometraje o tiempo transcurrido en preventivos cuenta como tiempo operativo activo si el vehículo estuvo en ruta.

2. **Diferenciación de Cálculo MTBF vs MTTF**:
   - Si `action_taken == 'REPAIRED'`, el evento incrementa el contador de fallas para el **MTBF** del vehículo/sistema.
   - Si `action_taken == 'REPLACED'` y el componente es consumible, el kilometraje acumulado por ese componente desde su instalación hasta el evento se agrega al cálculo del **MTTF** específico de la pieza.

3. **Cálculo de Tiempos Muertos (MTTR)**:
   - $\text{MTTR\_Total} = \text{workshop\_exit\_time} - \text{failure\_timestamp}$
   - $\text{Tiempo\_Espera\_Logística} = \text{workshop\_entry\_time} - \text{failure\_timestamp}$
   - $\text{Tiempo\_Taller\_Puro} = \text{workshop\_exit\_time} - \text{workshop\_entry\_time}$

---

## 5. Esquema de Base de Datos Recomendado (SQL DDL)

```sql
CREATE TYPE event_type_enum AS ENUM ('CORRECTIVE', 'PREVENTIVE', 'INSPECTION');
CREATE TYPE action_taken_enum AS ENUM ('REPAIRED', 'REPLACED', 'ADJUSTED');
CREATE TYPE system_category_enum AS ENUM ('ENGINE', 'TRANSMISSION', 'BRAKES', 'ELECTRICAL', 'TIRES', 'SUSPENSION', 'OTHER');
CREATE TYPE root_cause_enum AS ENUM ('WEAR_AND_TEAR', 'OPERATOR_ERROR', 'PART_DEFECT', 'ACCIDENT');

CREATE TABLE maintenance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id VARCHAR(50) NOT NULL,
    current_odometer DECIMAL(10,2) NOT NULL,
    event_type event_type_enum NOT NULL,
    failure_timestamp TIMESTAMPTZ NOT NULL,
    workshop_entry_time TIMESTAMPTZ NOT NULL,
    workshop_exit_time TIMESTAMPTZ NOT NULL,
    effective_work_hours DECIMAL(5,2),
    system_category system_category_enum NOT NULL,
    component_id VARCHAR(100) NOT NULL,
    action_taken action_taken_enum NOT NULL,
    root_cause root_cause_enum,
    repair_cost DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_timestamps CHECK (
        workshop_exit_time >= workshop_entry_time AND
        workshop_entry_time >= failure_timestamp
    )
);

CREATE INDEX idx_maintenance_vehicle_event ON maintenance_events(vehicle_id, event_type);
CREATE INDEX idx_maintenance_component ON maintenance_events(component_id, action_taken);
```
