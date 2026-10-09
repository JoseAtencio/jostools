import { collection, addDoc, getDocs, query, where, Timestamp, doc, updateDoc, getDoc, arrayUnion } from "@firebase/firestore";
import { db } from "@jostools/firebase-config";
import * as XLSX from "xlsx";
import type { MaintenanceEventInput, MaintenanceEvent, EditChange, EditHistoryEntry } from "@/types/maintenance";
import { EVENT_TYPE_LABELS, ACTION_TYPE_LABELS, SYSTEM_CATEGORY_LABELS, ROOT_CAUSE_LABELS, EVENT_STATUS_LABELS, FIELD_LABELS, BLOCK_REASON_LABELS } from "@/types/maintenance";

const maintenanceRef = collection(db, "jostools", "config", "maintenance_events");

function toISOString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "toDate" in val) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function createMaintenanceEvent(data: MaintenanceEventInput): Promise<string> {
  const docRef = await addDoc(maintenanceRef, {
    ...data,
    failure_timestamp: Timestamp.fromDate(new Date(data.failure_timestamp)),
    workshop_entry_time: Timestamp.fromDate(new Date(data.workshop_entry_time)),
    workshop_exit_time: data.workshop_exit_time ? Timestamp.fromDate(new Date(data.workshop_exit_time)) : null,
    created_at: Timestamp.now(),
    status: data.status || "PENDING",
    enterpriseId: data.enterpriseId,
  });
  return docRef.id;
}

export async function getMaintenanceEvents(enterpriseId: string): Promise<MaintenanceEvent[]> {
  const q = query(maintenanceRef, where("enterpriseId", "==", enterpriseId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc: any) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      failure_timestamp: toISOString(data.failure_timestamp),
      workshop_entry_time: toISOString(data.workshop_entry_time),
      workshop_exit_time: data.workshop_exit_time ? toISOString(data.workshop_exit_time) : "",
      created_at: toISOString(data.created_at),
      status: data.status || "PENDING",
      enterpriseId: data.enterpriseId,
    } as MaintenanceEvent;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getEventById(id: string): Promise<MaintenanceEvent | null> {
  const snap = await getDoc(doc(maintenanceRef, id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    failure_timestamp: toISOString(data.failure_timestamp),
    workshop_entry_time: toISOString(data.workshop_entry_time),
    workshop_exit_time: data.workshop_exit_time ? toISOString(data.workshop_exit_time) : "",
    created_at: toISOString(data.created_at),
    status: data.status || "PENDING",
    enterpriseId: data.enterpriseId,
  } as MaintenanceEvent;
}

export async function updateMaintenanceEvent(id: string, data: Partial<MaintenanceEventInput>): Promise<void> {
  const docRef = doc(db, "jostools", "config", "maintenance_events", id);
  await updateDoc(docRef, buildUpdateData(data));
}

function buildUpdateData(data: Partial<MaintenanceEventInput>): Record<string, unknown> {
  const updateData: Record<string, unknown> = { ...data };
  if (data.failure_timestamp) updateData.failure_timestamp = Timestamp.fromDate(new Date(data.failure_timestamp));
  if (data.workshop_entry_time) updateData.workshop_entry_time = Timestamp.fromDate(new Date(data.workshop_entry_time));
  if (data.workshop_exit_time) updateData.workshop_exit_time = Timestamp.fromDate(new Date(data.workshop_exit_time));
  return updateData;
}

export function formatHistoryValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "vacio";
  if (field === "status") return EVENT_STATUS_LABELS[value as "PENDING" | "COMPLETED"] ?? String(value);
  if (field === "event_type") return EVENT_TYPE_LABELS[value as keyof typeof EVENT_TYPE_LABELS] ?? String(value);
  if (field === "system_category") return SYSTEM_CATEGORY_LABELS[value as keyof typeof SYSTEM_CATEGORY_LABELS] ?? String(value);
  if (field === "action_taken") return ACTION_TYPE_LABELS[value as keyof typeof ACTION_TYPE_LABELS] ?? String(value);
  if (field === "root_cause") return ROOT_CAUSE_LABELS[value as keyof typeof ROOT_CAUSE_LABELS] ?? String(value);
  if (field === "block_reason") return BLOCK_REASON_LABELS[value as string] ?? String(value);
  if (field === "failure_timestamp" || field === "workshop_entry_time" || field === "workshop_exit_time") {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
  }
  if (field === "effective_work_hours") return `${value} h`;
  if (field === "repair_cost") return `$${Number(value).toLocaleString("es-ES")}`;
  return String(value);
}

export function buildEventChanges(before: MaintenanceEvent, data: Record<string, unknown>): EditChange[] {
  const changes: EditChange[] = [];
  for (const key of Object.keys(data)) {
    const prev = (before as unknown as Record<string, unknown>)[key];
    const next = data[key];
    const from = formatHistoryValue(key, prev);
    const to = formatHistoryValue(key, next);
    if (from !== to) changes.push({ field: key, label: FIELD_LABELS[key] ?? key, from, to });
  }
  return changes;
}

export async function saveEventChanges(id: string, data: Partial<MaintenanceEventInput>, changes: EditChange[], editorName: string): Promise<void> {
  const docRef = doc(db, "jostools", "config", "maintenance_events", id);
  const updateData = buildUpdateData(data);
  if (changes.length > 0) {
    const entry: EditHistoryEntry = { at: new Date().toISOString(), by: editorName, changes };
    updateData.edited_at = entry.at;
    updateData.edited_by = editorName;
    updateData.edit_history = arrayUnion(entry);
  }
  await updateDoc(docRef, updateData);
}

export async function reopenMaintenanceEvent(event: MaintenanceEvent, editorName: string): Promise<void> {
  const changes: EditChange[] = [
    { field: "status", label: FIELD_LABELS.status, from: EVENT_STATUS_LABELS.COMPLETED, to: EVENT_STATUS_LABELS.PENDING },
  ];
  if (event.workshop_exit_time) {
    changes.push({ field: "workshop_exit_time", label: FIELD_LABELS.workshop_exit_time, from: formatHistoryValue("workshop_exit_time", event.workshop_exit_time), to: "vacio" });
  }
  if (event.effective_work_hours != null) {
    changes.push({ field: "effective_work_hours", label: FIELD_LABELS.effective_work_hours, from: formatHistoryValue("effective_work_hours", event.effective_work_hours), to: "vacio" });
  }
  if (event.repair_cost) {
    changes.push({ field: "repair_cost", label: FIELD_LABELS.repair_cost, from: formatHistoryValue("repair_cost", event.repair_cost), to: "vacio" });
  }
  if (event.block_reason) {
    changes.push({ field: "block_reason", label: FIELD_LABELS.block_reason, from: BLOCK_REASON_LABELS[event.block_reason] ?? event.block_reason, to: "vacio" });
  }
  const entry: EditHistoryEntry = { at: new Date().toISOString(), by: editorName, changes };
  const docRef = doc(db, "jostools", "config", "maintenance_events", event.id);
  await updateDoc(docRef, {
    status: "PENDING",
    workshop_exit_time: null,
    effective_work_hours: null,
    repair_cost: 0,
    block_reason: "",
    edited_at: entry.at,
    edited_by: editorName,
    edit_history: arrayUnion(entry),
  });
}

function randomDate(daysBack: number): Date {
  const now = Date.now();
  const past = now - daysBack * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past));
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function seedTestEvents(userId: string, enterpriseId: string, count = 10): Promise<void> {
  const vehicles = ["VEH-001", "VEH-002", "VEH-003", "VEH-004", "VEH-005", "CAM-101", "CAM-102", "BUS-201"];
  const components = ["Filtro de aceite", "Pastillas de freno", "Bateria", "Correa alternador", "Radiador", "Suspension delantera", "Caja de cambios", "Embrague", "Turbo", "Inyectores"];
  const eventTypes: Array<"CORRECTIVE" | "PREVENTIVE" | "INSPECTION" | "PREDICTIVE"> = ["CORRECTIVE", "PREVENTIVE", "INSPECTION", "PREDICTIVE"];
  const actionTypes: Array<"REPAIRED" | "REPLACED" | "ADJUSTED"> = ["REPAIRED", "REPLACED", "ADJUSTED"];
  const categories: Array<"ENGINE" | "TRANSMISSION" | "BRAKES" | "ELECTRICAL" | "TIRES" | "SUSPENSION" | "OTHER"> = ["ENGINE", "TRANSMISSION", "BRAKES", "ELECTRICAL", "TIRES", "SUSPENSION", "OTHER"];
  const rootCauses: Array<"WEAR_AND_TEAR" | "OPERATOR_ERROR" | "PART_DEFECT" | "ACCIDENT"> = ["WEAR_AND_TEAR", "OPERATOR_ERROR", "PART_DEFECT", "ACCIDENT"];

  const batch = Array.from({ length: count }, (_, i) => {
    const failure = randomDate(180);
    const entryOffset = Math.floor(Math.random() * 48 + 1) * 3600000;
    const exitOffset = Math.floor(Math.random() * 24 + 1) * 3600000;
    const entry = new Date(failure.getTime() + entryOffset);
    const exit = new Date(entry.getTime() + exitOffset);
    const hours = Math.round((exit.getTime() - entry.getTime()) / 3600000 * 10) / 10;

    const data: MaintenanceEventInput = {
      vehicle_id: randomFrom(vehicles),
      current_odometer: Math.floor(Math.random() * 150000 + 20000),
      event_type: randomFrom(eventTypes),
      failure_timestamp: failure.toISOString(),
      workshop_entry_time: entry.toISOString(),
      workshop_exit_time: exit.toISOString(),
      effective_work_hours: Math.round(hours * 10) / 10,
      system_category: randomFrom(categories),
      component_id: randomFrom(components),
      action_taken: randomFrom(actionTypes),
      root_cause: randomFrom(rootCauses),
      repair_cost: Math.floor(Math.random() * 2000 + 50),
      user_id: userId,
      enterpriseId,
    };

    return addDoc(maintenanceRef, {
      ...data,
      failure_timestamp: Timestamp.fromDate(new Date(data.failure_timestamp)),
      workshop_entry_time: Timestamp.fromDate(new Date(data.workshop_entry_time)),
      workshop_exit_time: Timestamp.fromDate(new Date(data.workshop_exit_time)),
      created_at: Timestamp.now(),
      status: "COMPLETED",
      enterpriseId,
    });
  });

  await Promise.all(batch);
}

export function exportEventsToExcel(events: MaintenanceEvent[], indicators: { mtbf: number | null; mttr: number | null; mttf: number | null; availability: number | null }): void {
  const wb = XLSX.utils.book_new();

  const rows = events.map((e) => ({
    "ID": e.id,
    "Vehiculo": e.vehicle_id,
    "Odometro (km)": e.current_odometer,
    "Tipo de evento": EVENT_TYPE_LABELS[e.event_type],
    "Fecha de falla": new Date(e.failure_timestamp).toLocaleDateString("es-CO"),
    "Entrada al taller": new Date(e.workshop_entry_time).toLocaleDateString("es-CO"),
    "Salida del taller": new Date(e.workshop_exit_time).toLocaleDateString("es-CO"),
    "Horas efectivas": e.effective_work_hours,
    "Categoria": SYSTEM_CATEGORY_LABELS[e.system_category],
    "Componente": e.component_id,
    "Accion tomada": ACTION_TYPE_LABELS[e.action_taken],
    "Causa raiz": e.root_cause ? ROOT_CAUSE_LABELS[e.root_cause] : "",
    "Costo de reparacion": e.repair_cost,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 28 },
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 },
    { wch: 14 }, { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Eventos");

  const indRows = [
    { Indicador: "MTBF (horas)", Valor: indicators.mtbf?.toFixed(1) ?? "--" },
    { Indicador: "MTTR (horas)", Valor: indicators.mttr?.toFixed(1) ?? "--" },
    { Indicador: "MTTF (horas)", Valor: indicators.mttf?.toFixed(1) ?? "--" },
    { Indicador: "Disponibilidad (%)", Valor: indicators.availability?.toFixed(1) ?? "--" },
    { Indicador: "Total eventos", Valor: events.length },
  ];
  const wsInd = XLSX.utils.json_to_sheet(indRows);
  wsInd["!cols"] = [{ wch: 22 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsInd, "Indicadores");

  XLSX.writeFile(wb, `JosTools_Reporte_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
