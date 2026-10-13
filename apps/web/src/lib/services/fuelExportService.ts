import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { FuelMovement, FuelCierre } from "@/types/fuel";
import { FUEL_CATEGORY_LABELS, FUEL_TIPO_LABELS } from "@/types/fuel";
import { monthLabelOfKey } from "./fuelKardexService";

function shortDate(iso: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--" : d.toLocaleDateString("es-ES");
}

const num2 = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function destinoOf(m: FuelMovement, vehicleLabel: (id: string) => string): string {
  if (m.categoria === "interno") return vehicleLabel(m.vehicle_id || "") || "--";
  if (m.categoria === "planta") return `Despacho asfalto (${num2(m.toneladas ?? 0)} ton x ${num2(m.t_l ?? 0)})`;
  if (m.categoria === "sindicato") return [m.chofer, m.placa ? `placa ${m.placa}` : ""].filter(Boolean).join(" - ") || "--";
  if (m.categoria === "tercero") return m.placa ? `Placa ${m.placa}` : "--";
  return m.proveedor || "--";
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

function movementRow(m: FuelMovement, vehicleLabel: (id: string) => string) {
  return [
    shortDate(m.fecha),
    FUEL_TIPO_LABELS[m.tipo],
    FUEL_CATEGORY_LABELS[m.categoria],
    destinoOf(m, vehicleLabel),
    m.obra || "--",
    num2(m.litros),
    m.soporte || m.nro_factura || "--",
  ];
}

export function exportFuelToExcel(cierre: FuelCierre, monthKey: string, vehicleLabel: (id: string) => string): void {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Dato: "Mes", "Valor (L)": monthLabelOfKey(monthKey) },
      { Dato: "Existencia previa", "Valor (L)": cierre.previa },
      { Dato: "Ingresos (compras)", "Valor (L)": cierre.ingresos },
      { Dato: "Interno (flota/obra)", "Valor (L)": cierre.porCategoria.interno },
      { Dato: "Despacho planta", "Valor (L)": cierre.porCategoria.planta },
      { Dato: "Sindicato", "Valor (L)": cierre.porCategoria.sindicato },
      { Dato: "Terceros", "Valor (L)": cierre.porCategoria.tercero },
      { Dato: "Consumo total", "Valor (L)": cierre.consumo },
      { Dato: "Existencia final", "Valor (L)": cierre.existencia },
    ]),
    "Cierre"
  );

  const byCategoria = (cat: FuelMovement["categoria"]) => cierre.movementsInMonth.filter((m) => m.categoria === cat);

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      byCategoria("interno").map((m) => ({
        Fecha: shortDate(m.fecha),
        Vehiculo: vehicleLabel(m.vehicle_id || "") || "",
        Obra: m.obra || "",
        Litros: m.litros,
        Soporte: m.soporte || "",
      }))
    ),
    "Interno"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      byCategoria("planta").map((m) => ({
        Fecha: shortDate(m.fecha),
        Toneladas: m.toneladas ?? 0,
        "T/L": m.t_l ?? 0,
        Litros: m.litros,
        Obra: m.obra || "",
      }))
    ),
    "Planta"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      byCategoria("sindicato").map((m) => ({
        Fecha: shortDate(m.fecha),
        Chofer: m.chofer || "",
        "C.I.": m.ci || "",
        "Nro Factura": m.nro_factura || "",
        Placas: m.placa || "",
        Litros: m.litros,
      }))
    ),
    "Sindicato"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      byCategoria("tercero").map((m) => ({
        Fecha: shortDate(m.fecha),
        Placa: m.placa || "",
        Litros: m.litros,
        Soporte: m.soporte || "",
        Talonario: m.talonario || "",
      }))
    ),
    "Terceros"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      byCategoria("compra").map((m) => ({
        Fecha: shortDate(m.fecha),
        Proveedor: m.proveedor || "",
        "Nro Control": m.nro_control || "",
        "Nro Factura": m.nro_factura || "",
        Litros: m.litros,
      }))
    ),
    "Ingresos"
  );

  XLSX.writeFile(wb, `Kardex_Gasoil_${monthKey}.xlsx`);
}

export function exportFuelToPdf(cierre: FuelCierre, monthKey: string, vehicleLabel: (id: string) => string): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setTextColor(30);
  doc.text("Kardex de Gasoil", 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${monthLabelOfKey(monthKey)} | Generado: ${new Date().toLocaleDateString("es-ES")}`, 14, 23);

  autoTable(doc, {
    startY: 29,
    head: [["Cierre del mes", "Litros"]],
    body: [
      ["Existencia previa", num2(cierre.previa)],
      ["Ingresos (compras)", num2(cierre.ingresos)],
      ["Interno (flota/obra)", num2(cierre.porCategoria.interno)],
      ["Despacho planta", num2(cierre.porCategoria.planta)],
      ["Sindicato", num2(cierre.porCategoria.sindicato)],
      ["Terceros", num2(cierre.porCategoria.tercero)],
      ["Consumo total", num2(cierre.consumo)],
      ["Existencia final", num2(cierre.existencia)],
    ],
    ...tableStyles(),
  });

  let titleY = lastFinalY(doc) + 10;
  if (titleY > 265) {
    doc.addPage();
    titleY = 20;
  }
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text(`Movimientos del mes (${cierre.movementsInMonth.length})`, 14, titleY);

  autoTable(doc, {
    startY: titleY + 5,
    head: [["Fecha", "Tipo", "Categoria", "Vehiculo / Destino", "Obra", "Litros", "Soporte"]],
    body: cierre.movementsInMonth.map((m) => movementRow(m, vehicleLabel)),
    ...tableStyles(),
  });

  doc.save(`Kardex_Gasoil_${monthKey}.pdf`);
}
