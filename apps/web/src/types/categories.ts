export interface Category {
  id: string;
  name: string;
  label: string;
  group: string;
  active: boolean;
  created_at: string;
}

export type CategoryGroup =
  | "event_type"
  | "system_category"
  | "component"
  | "action_taken"
  | "root_cause";

export const CATEGORY_GROUPS: Record<CategoryGroup, string> = {
  event_type: "Tipo de Evento",
  system_category: "Sistema Afectado",
  component: "Componente",
  action_taken: "Accion Realizada",
  root_cause: "Causa Raiz",
};

export const DEFAULT_CATEGORIES: Omit<Category, "id" | "created_at">[] = [
  // Event Types
  { name: "CORRECTIVE", label: "Correctivo (Falla imprevista)", group: "event_type", active: true },
  { name: "PREVENTIVE", label: "Preventivo (Mantenimiento programado)", group: "event_type", active: true },
  { name: "INSPECTION", label: "Inspeccion", group: "event_type", active: true },

  // System Categories
  { name: "ENGINE", label: "Motor", group: "system_category", active: true },
  { name: "TRANSMISSION", label: "Transmision", group: "system_category", active: true },
  { name: "BRAKES", label: "Frenos", group: "system_category", active: true },
  { name: "ELECTRICAL", label: "Electrico", group: "system_category", active: true },
  { name: "TIRES", label: "Neumaticos", group: "system_category", active: true },
  { name: "SUSPENSION", label: "Suspension", group: "system_category", active: true },
  { name: "COOLING", label: "Enfriamiento", group: "system_category", active: true },
  { name: "FUEL", label: "Combustible", group: "system_category", active: true },
  { name: "EXHAUST", label: "Escape", group: "system_category", active: true },
  { name: "HVAC", label: "Aire acondicionado", group: "system_category", active: true },
  { name: "BODY", label: "Carroceria", group: "system_category", active: true },
  { name: "INTERIOR", label: "Interior", group: "system_category", active: true },
  { name: "OTHER", label: "Otro", group: "system_category", active: true },

  // Components - Engine
  { name: "ENGINE_BLOCK", label: "Bloque de motor", group: "component", active: true },
  { name: "CYLINDER_HEAD", label: "Cabeza de cilindros", group: "component", active: true },
  { name: "PISTONS", label: "Pistones", group: "component", active: true },
  { name: "CRANKSHAFT", label: "Ciguenal", group: "component", active: true },
  { name: "CAMSHAFT", label: "Arbol de levas", group: "component", active: true },
  { name: "TIMING_BELT", label: "Correa de distribucion", group: "component", active: true },
  { name: "TIMING_CHAIN", label: "Cadena de distribucion", group: "component", active: true },
  { name: "OIL_PUMP", label: "Bomba de aceite", group: "component", active: true },
  { name: "WATER_PUMP", label: "Bomba de agua", group: "component", active: true },
  { name: "THERMOSTAT", label: "Termostato", group: "component", active: true },
  { name: "RADIATOR", label: "Radiador", group: "component", active: true },
  { name: "TURBO", label: "Turbo", group: "component", active: true },
  { name: "ALTERNATOR", label: "Alternador", group: "component", active: true },
  { name: "STARTER", label: "Marcha / Motor de arranque", group: "component", active: true },
  { name: "FUEL_PUMP", label: "Bomba de combustible", group: "component", active: true },
  { name: "FUEL_INJECTORS", label: "Inyectores", group: "component", active: true },
  { name: "FUEL_FILTER", label: "Filtro de combustible", group: "component", active: true },
  { name: "OIL_FILTER", label: "Filtro de aceite", group: "component", active: true },
  { name: "AIR_FILTER", label: "Filtro de aire", group: "component", active: true },
  { name: "SPARK_PLUGS", label: "Bujias", group: "component", active: true },
  { name: "IGNITION_COILS", label: "Bobinas de encendido", group: "component", active: true },
  { name: "BELTS", label: "Correas", group: "component", active: true },
  { name: "HOSES", label: "Mangueras", group: "component", active: true },

  // Components - Transmission
  { name: "TRANSMISSION_BOX", label: "Caja de transmision", group: "component", active: true },
  { name: "CLUTCH", label: "Embrague", group: "component", active: true },
  { name: "CLUTCH_DISC", label: "Disco de embrague", group: "component", active: true },
  { name: "PRESSURE_PLATE", label: "Plato de presion", group: "component", active: true },
  { name: "GEARS", label: "Engranajes", group: "component", active: true },
  { name: "DRIVESHAFT", label: "Arbol de transmision", group: "component", active: true },
  { name: "CV_JOINT", label: "Junta homocinetica", group: "component", active: true },
  { name: "DIFFERENTIAL", label: "Diferencial", group: "component", active: true },
  { name: "AUTOMATIC_FLUID", label: "Fluidos de automatica", group: "component", active: true },

  // Components - Brakes
  { name: "BRAKE_PADS", label: "Pastillas de freno", group: "component", active: true },
  { name: "BRAKE_DISCS", label: "Discos de freno", group: "component", active: true },
  { name: "BRAKE_DRUMS", label: "Tambores de freno", group: "component", active: true },
  { name: "BRAKE_CALIPERS", label: "Calipers / Cilindros", group: "component", active: true },
  { name: "BRAKE_LINES", label: "Lineas de freno", group: "component", active: true },
  { name: "BRAKE_FLUID", label: "Fluido de frenos", group: "component", active: true },
  { name: "ABS_SENSOR", label: "Sensor ABS", group: "component", active: true },
  { name: "ABS_MODULE", label: "Modulo ABS", group: "component", active: true },
  { name: "PARKING_BRAKE", label: "Freno de estacionamiento", group: "component", active: true },

  // Components - Electrical
  { name: "BATTERY", label: "Bateria", group: "component", active: true },
  { name: "WIRING_HARNESS", label: "Arnés electrico", group: "component", active: true },
  { name: "FUSES", label: "Fusibles", group: "component", active: true },
  { name: "RELAYS", label: "Relés", group: "component", active: true },
  { name: "LIGHTS", label: "Luces", group: "component", active: true },
  { name: "HEADLIGHTS", label: "Faros", group: "component", active: true },
  { name: "TAIL_LIGHTS", label: "Luces traseras", group: "component", active: true },
  { name: "INDICATORS", label: "Direccionales", group: "component", active: true },
  { name: "HORN", label: "Bocina", group: "component", active: true },
  { name: "WIPERS", label: "Limpiaparabrisas", group: "component", active: true },
  { name: "ECU", label: "Unidad de control (ECU)", group: "component", active: true },
  { name: "SENSORS", label: "Sensores", group: "component", active: true },
  { name: "GAUGES", label: "Instrumentos / Gauges", group: "component", active: true },

  // Components - Tires
  { name: "FRONT_TIRES", label: "Neumaticos delanteros", group: "component", active: true },
  { name: "REAR_TIRES", label: "Neumaticos traseros", group: "component", active: true },
  { name: "SPARE_TIRE", label: "Repuesto", group: "component", active: true },
  { name: "WHEELS", label: "Llantas", group: "component", active: true },
  { name: "TIRE_VALVES", label: "Valvulas", group: "component", active: true },
  { name: "TPMS_SENSOR", label: "Sensor TPMS", group: "component", active: true },

  // Components - Suspension
  { name: "SHOCK_ABSORBERS", label: "Amortiguadores", group: "component", active: true },
  { name: "STRUTS", label: "Horquillas / McPherson", group: "component", active: true },
  { name: "SPRINGS", label: "Muelles / Resortes", group: "component", active: true },
  { name: "LEAF_SPRINGS", label: "Ballestas", group: "component", active: true },
  { name: "CONTROL_ARMS", label: "Brazos de suspension", group: "component", active: true },
  { name: "BALL_JOINTS", label: "Rótulas", group: "component", active: true },
  { name: "TIE_RODS", label: "Terminales de direccion", group: "component", active: true },
  { name: "SWAY_BAR", label: "Barra estabilizadora", group: "component", active: true },
  { name: "WHEEL_BEARINGS", label: "Rodamientos de rueda", group: "component", active: true },
  { name: "ALIGNMENT", label: "Alineacion", group: "component", active: true },

  // Components - Cooling
  { name: "RADIATOR_CAP", label: "Tapa de radiador", group: "component", active: true },
  { name: "COOLANT", label: "Refrigerante", group: "component", active: true },
  { name: "FAN", label: "Abanico / Ventilador", group: "component", active: true },

  // Components - Fuel
  { name: "FUEL_TANK", label: "Tanque de combustible", group: "component", active: true },
  { name: "FUEL_LINES", label: "Lineas de combustible", group: "component", active: true },
  { name: "CARBURETOR", label: "Carburador", group: "component", active: true },

  // Components - Exhaust
  { name: "MUFFLER", label: "Escape / Silenciador", group: "component", active: true },
  { name: "CATALYTIC_CONVERTER", label: "Convertidor catalitico", group: "component", active: true },
  { name: "OXYGEN_SENSOR", label: "Sensor de oxigeno", group: "component", active: true },
  { name: "DPF", label: "Filtro de partículas (DPF)", group: "component", active: true },

  // Components - HVAC
  { name: "AC_COMPRESSOR", label: "Compresor de A/C", group: "component", active: true },
  { name: "AC_CONDENSER", label: "Condensador de A/C", group: "component", active: true },
  { name: "AC_EVAPORATOR", label: "Evaporador", group: "component", active: true },
  { name: "AC_GAS", label: "Gas refrigerante", group: "component", active: true },
  { name: "HEATER_CORE", label: "Nucleo de calefaccion", group: "component", active: true },
  { name: "BLOW_MOTOR", label: "Motor soplador", group: "component", active: true },

  // Components - Body
  { name: "DOORS", label: "Puertas", group: "component", active: true },
  { name: "WINDOWS", label: "Vidrios / Cristales", group: "component", active: true },
  { name: "MIRRORS", label: "Retrovisores", group: "component", active: true },
  { name: "BUMPER", label: "Parachoques", group: "component", active: true },
  { name: "FENDERS", label: "Guardabarros", group: "component", active: true },
  { name: "HOOD", label: "Capo", group: "component", active: true },
  { name: "TRUNK", label: "Maletero / Caja", group: "component", active: true },
  { name: "PAINT", label: "Pintura", group: "component", active: true },
  { name: "GLASS", label: "Cristales", group: "component", active: true },

  // Components - Interior
  { name: "SEATS", label: "Asientos", group: "component", active: true },
  { name: "DASHBOARD", label: "Tablero", group: "component", active: true },
  { name: "STEERING_WHEEL", label: "Volante", group: "component", active: true },
  { name: "SEATBELTS", label: "Cinturones de seguridad", group: "component", active: true },
  { name: "AIRBAGS", label: "Airbags", group: "component", active: true },
  { name: "SOUND_SYSTEM", label: "Sistema de sonido", group: "component", active: true },
  { name: "UPHOLSTERY", label: "Tapiceria", group: "component", active: true },

  // Action Types
  { name: "REPAIRED", label: "Reparado (Pieza existente)", group: "action_taken", active: true },
  { name: "REPLACED", label: "Reemplazado (Pieza nueva)", group: "action_taken", active: true },
  { name: "ADJUSTED", label: "Ajustado", group: "action_taken", active: true },
  { name: "LUBRICATED", label: "Lubricado", group: "action_taken", active: true },
  { name: "CLEANED", label: "Limpiado", group: "action_taken", active: true },
  { name: "CALIBRATED", label: "Calibrado", group: "action_taken", active: true },

  // Root Causes
  { name: "WEAR_AND_TEAR", label: "Desgaste natural", group: "root_cause", active: true },
  { name: "OPERATOR_ERROR", label: "Error del operador", group: "root_cause", active: true },
  { name: "PART_DEFECT", label: "Defecto de repuesto", group: "root_cause", active: true },
  { name: "ACCIDENT", label: "Accidente", group: "root_cause", active: true },
  { name: "OVERLOAD", label: "Sobrecarga", group: "root_cause", active: true },
  { name: "ENVIRONMENT", label: "Condiciones ambientales", group: "root_cause", active: true },
  { name: "POOR_MAINTENANCE", label: "Falta de mantenimiento", group: "root_cause", active: true },
  { name: "CONTAMINATION", label: "Contaminacion de fluidos", group: "root_cause", active: true },
  { name: "VIBRATION", label: "Vibracion excesiva", group: "root_cause", active: true },
  { name: "OVERHEATING", label: "Sobrecalentamiento", group: "root_cause", active: true },
  { name: "UNKNOWN", label: "Desconocida", group: "root_cause", active: true },
];
