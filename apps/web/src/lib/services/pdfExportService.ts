import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { MaintenanceEvent } from "@/types/maintenance";
import {
  EVENT_TYPE_LABELS,
  ACTION_TYPE_LABELS,
  SYSTEM_CATEGORY_LABELS,
  ROOT_CAUSE_LABELS,
  EVENT_STATUS_LABELS,
} from "@/types/maintenance";

export function exportEventsToPdf(events: MaintenanceEvent[], titulo = "Reporte de Mantenimiento"): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.setTextColor(30);
  doc.text(`JosTools - ${titulo}`, 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `Generado: ${new Date().toLocaleDateString("es-ES")} | ${events.length} evento(s)`,
    14,
    20
  );

  const body = events.map((e) => [
    e.vehicle_id,
    EVENT_TYPE_LABELS[e.event_type] ?? e.event_type,
    EVENT_STATUS_LABELS[e.status || "PENDING"],
    new Date(e.failure_timestamp).toLocaleDateString("es-ES"),
    new Date(e.workshop_entry_time).toLocaleDateString("es-ES"),
    e.workshop_exit_time ? new Date(e.workshop_exit_time).toLocaleDateString("es-ES") : "--",
    e.effective_work_hours != null ? `${e.effective_work_hours} h` : "--",
    SYSTEM_CATEGORY_LABELS[e.system_category] ?? e.system_category,
    e.component_id || "--",
    ACTION_TYPE_LABELS[e.action_taken] ?? e.action_taken,
    e.root_cause ? ROOT_CAUSE_LABELS[e.root_cause] : "--",
    `$${e.repair_cost.toLocaleString("es-ES")}`,
  ]);

  autoTable(doc, {
    startY: 24,
    head: [[
      "Vehiculo", "Tipo", "Estado", "Falla", "Entrada", "Salida",
      "Horas", "Categoria", "Componente", "Accion", "Causa", "Costo",
    ]],
    body,
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [35, 35, 40], textColor: 245, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 244, 245] },
    margin: { left: 10, right: 10 },
  });

  doc.save(`${titulo.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
