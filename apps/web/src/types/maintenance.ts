export type EventType = "CORRECTIVE" | "PREVENTIVE" | "INSPECTION" | "PREDICTIVE";
export type ActionType = "REPAIRED" | "REPLACED" | "ADJUSTED";
export type SystemCategory = "ENGINE" | "TRANSMISSION" | "BRAKES" | "ELECTRICAL" | "TIRES" | "SUSPENSION" | "OTHER";
export type RootCause = "WEAR_AND_TEAR" | "OPERATOR_ERROR" | "PART_DEFECT" | "ACCIDENT";
export type EventStatus = "PENDING" | "COMPLETED";

export interface EditChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface EditHistoryEntry {
  at: string;
  by: string;
  changes: EditChange[];
}

export interface MaintenanceEvent {
  id: string;
  vehicle_id: string;
  current_odometer: number;
  event_type: EventType;
  failure_timestamp: string;
  workshop_entry_time: string;
  workshop_exit_time: string;
  effective_work_hours: number | null;
  system_category: SystemCategory;
  component_id: string;
  action_taken: ActionType;
  root_cause: RootCause | null;
  repair_cost: number;
  created_at: string;
  user_id: string;
  status: EventStatus;
  enterpriseId: string;
  edited_at?: string;
  edited_by?: string;
  edit_history?: EditHistoryEntry[];
  observation?: string;
  block_reason?: string;
}

export type MaintenanceEventInput = Omit<MaintenanceEvent, "id" | "created_at" | "status"> & { status?: EventStatus };

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  CORRECTIVE: "Correctivo (Falla imprevista)",
  PREVENTIVE: "Preventivo (Mantenimiento programado)",
  INSPECTION: "Inspeccion",
  PREDICTIVE: "Predictivo (Monitoreo de condicion)",
};

export const EVENT_TYPE_SHORT_LABELS: Record<EventType, string> = {
  CORRECTIVE: "Correctivo",
  PREVENTIVE: "Preventivo",
  INSPECTION: "Inspeccion",
  PREDICTIVE: "Predictivo",
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  REPAIRED: "Reparado (Pieza existente)",
  REPLACED: "Reemplazado (Pieza nueva)",
  ADJUSTED: "Ajustado",
};

export const SYSTEM_CATEGORY_LABELS: Record<SystemCategory, string> = {
  ENGINE: "Motor",
  TRANSMISSION: "Transmision",
  BRAKES: "Frenos",
  ELECTRICAL: "Electrico",
  TIRES: "Neumaticos",
  SUSPENSION: "Suspension",
  OTHER: "Otro",
};

export const ROOT_CAUSE_LABELS: Record<RootCause, string> = {
  WEAR_AND_TEAR: "Desgaste natural",
  OPERATOR_ERROR: "Error del operador",
  PART_DEFECT: "Defecto de repuesto",
  ACCIDENT: "Accidente",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  PENDING: "Abierto",
  COMPLETED: "Cerrado",
};

export const BLOCK_REASON_OPTIONS = [
  { name: "", label: "Sin bloqueo" },
  { name: "FALTA_REPUESTO", label: "Falta repuesto" },
  { name: "FALTA_PAGO", label: "Falta de pago" },
  { name: "SIN_DISPONIBILIDAD", label: "Sin disponibilidad del usuario" },
  { name: "OTRO", label: "Otro" },
];

export const BLOCK_REASON_LABELS: Record<string, string> = {
  FALTA_REPUESTO: "Falta repuesto",
  FALTA_PAGO: "Falta de pago",
  SIN_DISPONIBILIDAD: "Sin disponibilidad del usuario",
  OTRO: "Otro",
};

export const FIELD_LABELS: Record<string, string> = {
  status: "Estado",
  current_odometer: "Odometro",
  event_type: "Tipo de evento",
  failure_timestamp: "Fecha de falla",
  workshop_entry_time: "Entrada al taller",
  workshop_exit_time: "Salida del taller",
  system_category: "Sistema afectado",
  component_id: "Componente",
  action_taken: "Accion realizada",
  root_cause: "Causa raiz",
  effective_work_hours: "Horas efectivas",
  repair_cost: "Costo de reparacion",
  observation: "Observacion",
  block_reason: "Motivo de bloqueo",
};
