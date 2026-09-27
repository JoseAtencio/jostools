export type EventType = "CORRECTIVE" | "PREVENTIVE" | "INSPECTION" | "PREDICTIVE";
export type ActionType = "REPAIRED" | "REPLACED" | "ADJUSTED";
export type SystemCategory = "ENGINE" | "TRANSMISSION" | "BRAKES" | "ELECTRICAL" | "TIRES" | "SUSPENSION" | "OTHER";
export type RootCause = "WEAR_AND_TEAR" | "OPERATOR_ERROR" | "PART_DEFECT" | "ACCIDENT";
export type EventStatus = "PENDING" | "COMPLETED";

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
}

export type MaintenanceEventInput = Omit<MaintenanceEvent, "id" | "created_at" | "status"> & { status?: EventStatus };

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  CORRECTIVE: "Correctivo (Falla imprevista)",
  PREVENTIVE: "Preventivo (Mantenimiento programado)",
  INSPECTION: "Inspeccion",
  PREDICTIVE: "Predictivo (Monitoreo de condicion)",
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
