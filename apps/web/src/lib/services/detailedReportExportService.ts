import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import type { MaintenanceEvent } from "@/types/maintenance";
import {
  EVENT_TYPE_SHORT_LABELS,
  ACTION_TYPE_LABELS,
  SYSTEM_CATEGORY_LABELS,
  ROOT_CAUSE_LABELS,
  EVENT_STATUS_LABELS,
} from "@/types/maintenance";
import type { ReportSummary } from "./detailedReportService";
import { formatIndicator } from "./indicatorService";

export interface DetailedReportParams {
  events: MaintenanceEvent[];
  summary: ReportSummary;
  rangeLabel: string;
  chartsElement: HTMLElement | null;
  topVehiclesElement: HTMLElement | null;
}

const PORTRAIT_W = 210;
const PORTRAIT_H = 297;
const LANDSCAPE_W = 297;
const MARGIN = 14;
const CONTENT_W = PORTRAIT_W - MARGIN * 2;

const INK = [24, 24, 27] as const;
const MUTED = [113, 113, 122] as const;
const SOFT = [63, 63, 70] as const;
const LINE = [228, 228, 231] as const;
const CARD = [250, 250, 250] as const;
const ACCENT = [247, 183, 8] as const;
const APPLE = [180, 83, 9] as const;

function safeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortDate(iso: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--" : d.toLocaleDateString("es-ES");
}

function buildConclusions(summary: ReportSummary, rangeLabel: string): string {
  if (summary.total === 0) {
    return `No se registraron eventos de mantenimiento en el periodo (${rangeLabel}) con los filtros seleccionados.`;
  }
  const pct = (n: number) => (summary.total > 0 ? Math.round((n / summary.total) * 1000) / 10 : 0);
  const parts: string[] = [];
  parts.push(
    `En el periodo ${rangeLabel} se registraron ${summary.total} evento(s) de mantenimiento, con un costo total de $${summary.costTotal.toLocaleString("es-ES")} y ${summary.hoursTotal.toFixed(1)} hora(s) de trabajo efectivo.`
  );
  parts.push(
    `La composicion por tipo fue: ${summary.corrective} correctivo(s) (${pct(summary.corrective)}%), ${summary.preventive} preventivo(s) (${pct(summary.preventive)}%), ${summary.inspection} inspeccion(es) y ${summary.predictive} predictivo(s).`
  );
  parts.push(`Del total, ${summary.closed} evento(s) estan cerrados, ${summary.open} abierto(s) y ${summary.blocked} bloqueado(s).`);
  if (summary.indicators.mtbf != null) {
    parts.push(`El MTBF estimado es de ${formatIndicator(summary.indicators.mtbf, " h")} y el MTTR de ${formatIndicator(summary.indicators.mttr, " h")}.`);
  }
  if (summary.indicators.availability != null) {
    parts.push(`La disponibilidad estimada es de ${formatIndicator(summary.indicators.availability, "%")}.`);
  }
  if (summary.bySystem.length > 0) {
    parts.push(`Los sistemas con mayor incidencia fueron: ${summary.bySystem.slice(0, 3).map((s) => `${s.label} (${s.count})`).join(", ")}.`);
  }
  if (summary.byVehicle.length > 0) {
    parts.push(`Los vehiculos con mas eventos fueron: ${summary.byVehicle.slice(0, 3).map((v) => `${v.label} (${v.count})`).join(", ")}.`);
  }
  return parts.join(" ");
}

function eventRow(e: MaintenanceEvent): string[] {
  return [
    e.vehicle_id,
    EVENT_TYPE_SHORT_LABELS[e.event_type] ?? e.event_type,
    EVENT_STATUS_LABELS[e.status || "PENDING"],
    shortDate(e.failure_timestamp),
    shortDate(e.workshop_entry_time),
    e.workshop_exit_time ? shortDate(e.workshop_exit_time) : "--",
    e.effective_work_hours != null ? `${e.effective_work_hours} h` : "--",
    SYSTEM_CATEGORY_LABELS[e.system_category] ?? e.system_category,
    e.component_id || "--",
    ACTION_TYPE_LABELS[e.action_taken] ?? e.action_taken,
    e.root_cause ? ROOT_CAUSE_LABELS[e.root_cause] ?? e.root_cause : "--",
    `$${(e.repair_cost || 0).toLocaleString("es-ES")}`,
  ];
}

function lastFinalY(doc: jsPDF): number {
  const ref = doc as unknown as { lastAutoTable?: { finalY: number } };
  return ref.lastAutoTable?.finalY ?? 30;
}

function drawSectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(MARGIN, y - 2.6, 2.4, 2.4, "F");
  doc.setFontSize(11.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(text, MARGIN + 4.5, y);
  return y + 7;
}

function drawCompositionLine(doc: jsPDF, parts: { label: string; value: string }[], y: number): number {
  doc.setFontSize(8.6);
  let x = MARGIN;
  parts.forEach((part, i) => {
    if (i > 0) {
      doc.setTextColor(LINE[0], LINE[1], LINE[2]);
      doc.text("|", x, y);
      x += 3;
    }
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`${part.label}: `, x, y);
    x += doc.getTextWidth(`${part.label}: `);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(part.value, x, y);
    x += doc.getTextWidth(part.value) + 3;
  });
  return y + 5.6;
}

function drawKpiGrid(doc: jsPDF, items: { label: string; value: string; hint?: string }[], startY: number): number {
  const cols = 4;
  const gap = 3.2;
  const w = (CONTENT_W - gap * (cols - 1)) / cols;
  const h = 17.5;
  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (w + gap);
    const y = startY + row * (h + gap);
    doc.setFillColor(CARD[0], CARD[1], CARD[2]);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, h, 1.6, 1.6, "FD");
    doc.setFontSize(6.4);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(safeText(item.label).toUpperCase(), x + 3, y + 5.2);
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(safeText(item.value), x + 3, y + 12);
    if (item.hint) {
      doc.setFontSize(6.2);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(safeText(item.hint), x + 3, y + 15.8);
    }
  });
  return startY + Math.ceil(items.length / cols) * (h + gap);
}

function drawSummaryTable(
  doc: jsPDF,
  title: string,
  head: string[],
  body: string[][],
  startY: number,
  maxRows: number
): number {
  doc.setFontSize(9.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(safeText(title), MARGIN, startY);
  autoTable(doc, {
    startY: startY + 2.5,
    head: [head],
    body: body.slice(0, maxRows),
    styles: { fontSize: 7.6, cellPadding: 1.8, overflow: "linebreak" as const },
    headStyles: { fillColor: [244, 244, 245] as [number, number, number], textColor: [63, 63, 70] as [number, number, number], fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [252, 252, 253] as [number, number, number] },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
  });
  const ref = doc as unknown as { lastAutoTable?: { finalY: number } };
  return (ref.lastAutoTable?.finalY ?? startY + 20) + 6;
}

async function capture(el: HTMLElement | null): Promise<string | null> {
  if (!el) return null;
  try {
    await new Promise((resolve) => setTimeout(resolve, 180));
    const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2, logging: false });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function drawParagraph(doc: jsPDF, text: string, y: number, size = 8.2, color = SOFT): number {
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
  const lines = doc.splitTextToSize(safeText(text), CONTENT_W) as string[];
  lines.forEach((line) => {
    y += 4.2;
    doc.text(line, MARGIN, y);
  });
  return y + 1.5;
}

function drawIndicator(
  doc: jsPDF,
  name: string,
  value: string,
  text: string,
  y: number
): number {
  doc.setFontSize(9.6);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(safeText(name), MARGIN, y);
  doc.setFontSize(9.6);
  doc.setTextColor(APPLE[0], APPLE[1], APPLE[2]);
  doc.text(safeText(value), PORTRAIT_W - MARGIN, y, { align: "right" });
  y = drawParagraph(doc, text, y + 1, 8.2);
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.15);
  doc.line(MARGIN, y - 2.6, PORTRAIT_W - MARGIN, y - 2.6);
  return y + 1.5;
}

function drawGlossaryPage(doc: jsPDF, summary: ReportSummary): void {
  doc.addPage();
  let y = drawSectionTitle(doc, "Indicadores: que miden y con que datos se calculan", 22);

  y = drawIndicator(
    doc,
    "MTBF - Tiempo Medio Entre Fallas",
    formatIndicator(summary.indicators.mtbf, " h"),
    "Horas promedio que el vehiculo permanece operando entre una falla correctiva y la siguiente. Cuanto mas alto es, menos falla la flota. Se calcula con la fecha de falla y la fecha de salida del taller de los eventos correctivos: (tiempo total observado - tiempo en el taller) / numero de correctivos.",
    y
  );
  y = drawIndicator(
    doc,
    "MTTR - Tiempo Medio de Reparacion",
    formatIndicator(summary.indicators.mttr, " h"),
    "Horas promedio que tarda una reparacion, desde que ocurre la falla hasta que el vehiculo sale del taller. Incluye diagnostico, espera de repuestos y trabajo. Cuanto mas bajo es, mas eficiente es el taller. Solo se miden los correctivos con salida registrada.",
    y
  );
  y = drawIndicator(
    doc,
    "MTTF - Tiempo Medio Hasta la Falla",
    formatIndicator(summary.indicators.mttf, " h"),
    "Vida util promedio de las piezas que se reemplazaron. Se calcula con las horas efectivas de trabajo de los eventos cuya accion fue 'Reemplazado'. Sirve para saber cada cuanto hay que cambiar un consumible.",
    y
  );
  y = drawIndicator(
    doc,
    "Disponibilidad Operativa",
    formatIndicator(summary.indicators.availability, "%"),
    "Porcentaje del tiempo en que el vehiculo esta disponible para operar: MTBF / (MTBF + MTTR) x 100. Combina la confiabilidad (MTBF) con la rapidez de la reparacion (MTTR). Un valor de 95% o mas se considera excelente.",
    y
  );

  y = drawSectionTitle(doc, "Datos del registro que usa este reporte", y + 3);
  autoTable(doc, {
    startY: y,
    head: [["Dato del registro", "Para que sirve en el reporte"]],
    body: [
      ["Fecha de falla", "Define el periodo del reporte y el tiempo entre fallas (MTBF)"],
      ["Entrada al taller", "Marca el inicio de la intervencion del vehiculo"],
      ["Salida del taller", "Duracion de la reparacion (MTTR) y tiempo de inactividad (MTBF)"],
      ["Horas efectivas", "Trabajo real del taller: alimenta el MTTF y la carga de trabajo"],
      ["Tipo de evento", "Separa correctivos (fallas), preventivos, inspecciones y predictivos"],
      ["Sistema y componente", "Origen de las graficas por sistema y de las tablas por componente"],
      ["Causa raiz", "Muestra por que fallan los vehiculos y que accion las previene"],
      ["Costo de reparacion", "Costo por sistema, costo total y costo por vehiculo"],
      ["Estado y motivo de bloqueo", "Cuentan eventos abiertos, cerrados y bloqueados"],
      ["Odometro", "Referencia del recorrido del vehiculo en el momento del evento"],
    ],
    styles: { fontSize: 7.6, cellPadding: 1.7, overflow: "linebreak" as const },
    headStyles: { fillColor: [244, 244, 245] as [number, number, number], textColor: [39, 39, 42] as [number, number, number], fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [252, 252, 253] as [number, number, number] },
    columnStyles: { 0: { cellWidth: 46 } },
    margin: { left: MARGIN, right: MARGIN },
  });

  y = drawSectionTitle(doc, "Como leer cada grafica", lastFinalY(doc) + 8);
  const chartNotes: [string, string][] = [
    ["Distribucion por tipo de evento", "Como se reparten los eventos del periodo entre correctivos, preventivos, inspecciones y predictivos."],
    ["Eventos por mes", "Cuantos eventos se registraron en cada mes; muestra si la carga de taller sube o baja."],
    ["Tendencia MTBF / MTTR", "Evolucion mensual de la confiabilidad y de la eficiencia de las reparaciones."],
    ["Costos por categoria", "En que sistema del vehiculo se concentra el gasto de las reparaciones."],
    ["Top vehiculos con mas fallas", "Que vehiculos requieren atencion: son el punto de partida del plan preventivo."],
  ];
  chartNotes.forEach(([title, text]) => {
    doc.setFontSize(8.6);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(safeText(title), MARGIN, y + 4);
    const lines = doc.splitTextToSize(safeText(text), CONTENT_W - 52) as string[];
    doc.setFontSize(8.2);
    doc.setTextColor(SOFT[0], SOFT[1], SOFT[2]);
    lines.forEach((line, i) => doc.text(line, MARGIN + 52, y + 4 + i * 4.2));
    y += 4 + Math.max(1, lines.length) * 4.2 + 1.5;
  });
}

export async function exportDetailedReport({
  events,
  summary,
  rangeLabel,
  chartsElement,
  topVehiclesElement,
}: DetailedReportParams): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(18);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Reporte de Mantenimiento", MARGIN, 17);
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    safeText(`JosTools  |  Periodo: ${rangeLabel}  |  Generado: ${new Date().toLocaleDateString("es-ES")}  |  ${summary.total} evento(s)`),
    MARGIN,
    25
  );
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 30, PORTRAIT_W - MARGIN, 30);
  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.setLineWidth(1.1);
  doc.line(MARGIN, 30, MARGIN + 34, 30);

  const pctOf = (n: number) => (summary.total > 0 ? `${Math.round((n / summary.total) * 1000) / 10}%` : "0%");
  const avgCost = summary.total > 0 ? summary.costTotal / summary.total : 0;

  let y = drawSectionTitle(doc, "Resumen del periodo", 42);
  y = drawKpiGrid(
    doc,
    [
      { label: "Eventos", value: String(summary.total), hint: `${summary.byVehicle.length} vehiculo(s)` },
      { label: "MTBF", value: formatIndicator(summary.indicators.mtbf, " h"), hint: "Horas entre fallas" },
      { label: "MTTR", value: formatIndicator(summary.indicators.mttr, " h"), hint: "Horas de reparacion" },
      { label: "MTTF", value: formatIndicator(summary.indicators.mttf, " h"), hint: "Vida util de piezas" },
      { label: "Disponibilidad", value: formatIndicator(summary.indicators.availability, "%"), hint: "Tiempo operativo" },
      { label: "Horas de taller", value: `${summary.hoursTotal.toFixed(1)} h`, hint: "Trabajo efectivo" },
      { label: "Costo total", value: `$${summary.costTotal.toLocaleString("es-ES")}`, hint: "Reparaciones" },
      { label: "Costo promedio", value: `$${Math.round(avgCost).toLocaleString("es-ES")}`, hint: "Por evento" },
    ],
    y
  );

  y = drawSectionTitle(doc, "Composicion de los eventos", y + 3);
  y = drawCompositionLine(
    doc,
    [
      { label: "Correctivos", value: `${summary.corrective} (${pctOf(summary.corrective)})` },
      { label: "Preventivos", value: `${summary.preventive} (${pctOf(summary.preventive)})` },
      { label: "Inspecciones", value: `${summary.inspection} (${pctOf(summary.inspection)})` },
      { label: "Predictivos", value: `${summary.predictive} (${pctOf(summary.predictive)})` },
    ],
    y
  );
  y = drawCompositionLine(
    doc,
    [
      { label: "Cerrados", value: `${summary.closed} (${pctOf(summary.closed)})` },
      { label: "Abiertos", value: `${summary.open}` },
      { label: "Bloqueados", value: `${summary.blocked}` },
      { label: "Horas de taller", value: `${summary.hoursTotal.toFixed(1)} h` },
    ],
    y
  );

  y = drawSectionTitle(doc, "Conclusiones", y + 3);
  doc.setFontSize(8.6);
  doc.setTextColor(SOFT[0], SOFT[1], SOFT[2]);
  const conclusionLines = doc.splitTextToSize(safeText(buildConclusions(summary, rangeLabel)), CONTENT_W) as string[];
  conclusionLines.forEach((line) => {
    y += 4.4;
    if (y > PORTRAIT_H - 20) return;
    doc.text(line, MARGIN, y);
  });

  doc.addPage();
  let page2Y = drawSectionTitle(doc, "Graficas del periodo", 22);
  const chartsImg = await capture(chartsElement);
  if (chartsImg) {
    const props = doc.getImageProperties(chartsImg);
    const h = (props.height * CONTENT_W) / props.width;
    doc.addImage(chartsImg, "PNG", MARGIN, page2Y, CONTENT_W, Math.min(h, PORTRAIT_H - page2Y - 18));
  } else {
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("No se pudieron generar las graficas.", MARGIN, page2Y + 6);
  }

  doc.addPage();
  let page3Y = drawSectionTitle(doc, "Vehiculos con mas eventos", 22);
  const topImg = await capture(topVehiclesElement);
  if (topImg) {
    const props = doc.getImageProperties(topImg);
    const h = (props.height * CONTENT_W) / props.width;
    doc.addImage(topImg, "PNG", MARGIN, page3Y, CONTENT_W, h);
    page3Y += h + 4;
  }
  page3Y = drawSummaryTable(
    doc,
    "Eventos por sistema",
    ["Sistema", "Eventos", "Costo"],
    summary.bySystem.map((s) => [safeText(s.label), String(s.count), `$${s.cost.toLocaleString("es-ES")}`]),
    page3Y,
    6
  );
  page3Y = drawSummaryTable(
    doc,
    "Eventos por vehiculo",
    ["Vehiculo", "Eventos", "Costo"],
    summary.byVehicle.map((v) => [safeText(v.label), String(v.count), `$${v.cost.toLocaleString("es-ES")}`]),
    page3Y,
    6
  );
  drawSummaryTable(
    doc,
    "Causas y componentes mas frecuentes",
    ["Concepto", "Eventos", "Costo"],
    [
      ...summary.byRootCause.slice(0, 3).map((c) => [`Causa: ${safeText(c.label)}`, String(c.count), `$${c.cost.toLocaleString("es-ES")}`]),
      ...summary.byComponent.slice(0, 3).map((c) => [`Componente: ${safeText(c.label)}`, String(c.count), `$${c.cost.toLocaleString("es-ES")}`]),
    ],
    page3Y,
    6
  );

  drawGlossaryPage(doc, summary);

  doc.addPage("a4", "landscape");
  doc.setFontSize(13);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(`Detalle de eventos (${events.length})`, MARGIN, 14);
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 18, LANDSCAPE_W - MARGIN, 18);
  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.setLineWidth(1.1);
  doc.line(MARGIN, 18, MARGIN + 34, 18);

  autoTable(doc, {
    startY: 24,
    head: [[
      "Vehiculo", "Tipo", "Estado", "Falla", "Entrada", "Salida",
      "Horas", "Categoria", "Componente", "Accion", "Causa", "Costo",
    ]],
    body: events.map((e) => eventRow(e).map((v) => safeText(v))),
    styles: { fontSize: 6.6, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [244, 244, 245] as [number, number, number], textColor: [39, 39, 42] as [number, number, number], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [252, 252, 253] as [number, number, number] },
    margin: { left: MARGIN, right: MARGIN },
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.15);
    doc.line(MARGIN, h - 11, w - MARGIN, h - 11);
    doc.setFontSize(7.2);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("JosTools - Reporte de mantenimiento", MARGIN, h - 6.5);
    doc.text(`Pagina ${i} de ${total}`, w - MARGIN, h - 6.5, { align: "right" });
  }

  doc.save(`Reporte_Mantenimiento_${new Date().toISOString().slice(0, 10)}.pdf`);
}
