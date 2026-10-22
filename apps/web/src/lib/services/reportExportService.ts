import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import type { ReportData } from "./reportService";
import { formatIndicator } from "./indicatorService";
import { EVENT_TYPE_SHORT_LABELS, SYSTEM_CATEGORY_LABELS, EVENT_STATUS_LABELS, BLOCK_REASON_LABELS } from "@/types/maintenance";
import type { MaintenanceEvent } from "@/types/maintenance";

function shortDate(iso: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--" : d.toLocaleDateString("es-ES");
}

function lastFinalY(doc: jsPDF): number {
  const ref = doc as unknown as { lastAutoTable?: { finalY: number } };
  return ref.lastAutoTable?.finalY ?? 30;
}

function tableStyles() {
  return {
    styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" as const },
    headStyles: { fillColor: [35, 35, 40] as [number, number, number], textColor: 245, fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [244, 244, 245] as [number, number, number] },
    margin: { left: 14, right: 14 },
  };
}

function eventRow(e: MaintenanceEvent) {
  return [
    e.vehicle_id,
    EVENT_TYPE_SHORT_LABELS[e.event_type],
    shortDate(e.failure_timestamp),
    SYSTEM_CATEGORY_LABELS[e.system_category] ?? e.system_category,
    EVENT_STATUS_LABELS[e.status || "PENDING"],
    e.observation?.trim() || "--",
  ];
}

export async function exportReportToPdf(report: ReportData, conclusions: string, chartElements: (HTMLElement | null)[]): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setTextColor(30);
  doc.text("Informe Mensual de Mantenimiento e Infraestructura", 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${report.monthLabel} | Generado: ${new Date().toLocaleDateString("es-ES")}`, 14, 23);

  autoTable(doc, {
    startY: 29,
    head: [["Resumen del mes", "Valor"]],
    body: [
      ["Total de intervenciones", String(report.total)],
      ["Preventivos", `${report.preventive.length} (${report.preventivePct}%)`],
      ["Correctivos", `${report.corrective.length} (${report.correctivePct}%)`],
      ["Eficiencia de cierre", report.closureEfficiency != null ? `${report.closureEfficiency}%` : "--"],
      ["Cerrados en el mes", String(report.closedInMonth)],
      ["Backlog", String(report.backlog.length)],
      ["Costo total", `$${report.costTotal.toLocaleString("es-ES")}`],
      ["MTTR", formatIndicator(report.indicators.mttr, " h")],
      ["MTBF", formatIndicator(report.indicators.mtbf, " h")],
      ["Disponibilidad", formatIndicator(report.indicators.availability, "%")],
    ],
    ...tableStyles(),
  });

  let s1y = lastFinalY(doc) + 8;
  if (s1y > 265) {
    doc.addPage();
    s1y = 20;
  }
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text("Seccion 1 - Preventivos, inspecciones y predictivos", 14, s1y);
  autoTable(doc, {
    startY: s1y + 5,
    head: [["Vehiculo", "Tipo", "Falla", "Sistema", "Estado", "Observacion"]],
    body: [...report.preventive, ...report.inspection, ...report.predictive].map(eventRow),
    ...tableStyles(),
  });

  let s2y = lastFinalY(doc) + 8;
  if (s2y > 265) {
    doc.addPage();
    s2y = 20;
  }
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text("Seccion 2 - Correctivos", 14, s2y);
  autoTable(doc, {
    startY: s2y + 5,
    head: [["Vehiculo", "Tipo", "Falla", "Sistema", "Estado", "Observacion"]],
    body: report.corrective.map(eventRow),
    ...tableStyles(),
  });

  autoTable(doc, {
    startY: lastFinalY(doc) + 8,
    head: [["Distribucion por flota", "Eventos"]],
    body: report.byFleetGroup.map((g) => [g.label, String(g.count)]),
    ...tableStyles(),
  });

  autoTable(doc, {
    startY: lastFinalY(doc) + 8,
    head: [["Distribucion por sistema", "Eventos"]],
    body: report.bySystem.map((g) => [g.label, String(g.count)]),
    ...tableStyles(),
  });

  autoTable(doc, {
    startY: lastFinalY(doc) + 8,
    head: [["Backlog", "Estado", "Motivo de bloqueo"]],
    body: report.backlog.map((e) => [
      e.vehicle_id,
      EVENT_STATUS_LABELS[e.status || "PENDING"],
      e.block_reason ? BLOCK_REASON_LABELS[e.block_reason] ?? e.block_reason : "Sin bloqueo",
    ]),
    ...tableStyles(),
  });

  let y = lastFinalY(doc) + 10;
  if (y > 265) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text("Conclusiones", 14, y);
  doc.setFontSize(9);
  doc.setTextColor(70);
  const lines = doc.splitTextToSize(conclusions, 182) as string[];
  lines.forEach((line) => {
    y += 5;
    if (y > 285) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 14, y);
  });

  for (const el of chartElements) {
    if (!el) continue;
    try {
      const canvas = await html2canvas(el, { backgroundColor: "#1b1819", scale: 2 });
      const img = canvas.toDataURL("image/png");
      const w = 182;
      const h = (canvas.height * w) / canvas.width;
      doc.addPage();
      doc.addImage(img, "PNG", 14, 20, w, Math.min(h, 250));
    } catch {
      continue;
    }
  }

  doc.save(`Informe_${report.monthKey}.pdf`);
}

export function exportReportToExcel(report: ReportData, conclusions: string): void {
  const wb = XLSX.utils.book_new();

  const resumen = [
    { Dato: "Mes", Valor: report.monthLabel },
    { Dato: "Total intervenciones", Valor: report.total },
    { Dato: "Preventivos", Valor: `${report.preventive.length} (${report.preventivePct}%)` },
    { Dato: "Correctivos", Valor: `${report.corrective.length} (${report.correctivePct}%)` },
    { Dato: "Eficiencia de cierre", Valor: report.closureEfficiency != null ? `${report.closureEfficiency}%` : "--" },
    { Dato: "Cerrados en el mes", Valor: report.closedInMonth },
    { Dato: "Backlog", Valor: report.backlog.length },
    { Dato: "Costo total", Valor: report.costTotal },
    { Dato: "Conclusiones", Valor: conclusions },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen");

  const eventRows = (list: MaintenanceEvent[]) =>
    list.map((e) => ({
      Vehiculo: e.vehicle_id,
      Tipo: EVENT_TYPE_SHORT_LABELS[e.event_type],
      Falla: shortDate(e.failure_timestamp),
      Entrada: shortDate(e.workshop_entry_time),
      Salida: shortDate(e.workshop_exit_time),
      Horas: e.effective_work_hours ?? "",
      Sistema: SYSTEM_CATEGORY_LABELS[e.system_category] ?? e.system_category,
      Costo: e.repair_cost,
      Estado: EVENT_STATUS_LABELS[e.status || "PENDING"],
      Observacion: e.observation ?? "",
    }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventRows(report.preventive)), "Preventivos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventRows(report.corrective)), "Correctivos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.byFleetGroup.map((g) => ({ Flota: g.label, Eventos: g.count }))), "Flota");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.bySystem.map((g) => ({ Sistema: g.label, Eventos: g.count }))), "Sistema");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      report.backlog.map((e) => ({
        Vehiculo: e.vehicle_id,
        Estado: EVENT_STATUS_LABELS[e.status || "PENDING"],
        Motivo: e.block_reason ? BLOCK_REASON_LABELS[e.block_reason] ?? e.block_reason : "Sin bloqueo",
        Falla: shortDate(e.failure_timestamp),
      }))
    ),
    "Backlog"
  );

  XLSX.writeFile(wb, `Informe_${report.monthKey}.xlsx`);
}
