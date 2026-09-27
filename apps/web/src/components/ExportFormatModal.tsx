"use client";

interface ExportFormatModalProps {
  count: number;
  titulo?: string;
  onCancel: () => void;
  onExport: (format: "excel" | "pdf") => void;
}

export default function ExportFormatModal({ count, titulo = "reporte", onCancel, onExport }: ExportFormatModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onCancel}>
      <div className="rounded-2xl border w-full max-w-sm p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: "var(--graphite-100)" }}>Exportar {titulo}</h2>
          <button onClick={onCancel} className="p-1 rounded-lg cursor-pointer" style={{ color: "var(--graphite-500)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--graphite-200)"; e.currentTarget.style.backgroundColor = "var(--graphite-800)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--graphite-500)"; e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <p className="text-sm mb-5" style={{ color: "var(--graphite-400)" }}>
          Se exportara{count === 1 ? "" : "n"} <strong style={{ color: "var(--graphite-100)" }}>{count} evento{count === 1 ? "" : "s"}</strong>. Selecciona el formato:
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => onExport("excel")}
            className="flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all cursor-pointer"
            style={{ backgroundColor: "rgba(102, 153, 145, 0.15)", color: "var(--ash-grey-400)", border: "1px solid rgba(102, 153, 145, 0.3)" }}
          >
            Excel (.xlsx)
          </button>
          <button
            onClick={() => onExport("pdf")}
            className="flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all cursor-pointer"
            style={{ backgroundColor: "rgba(224, 31, 95, 0.15)", color: "var(--raspberry-red-400)", border: "1px solid rgba(224, 31, 95, 0.3)" }}
          >
            PDF
          </button>
        </div>

        <button
          onClick={onCancel}
          className="w-full mt-3 py-2.5 px-4 rounded-xl font-medium text-sm transition-all cursor-pointer"
          style={{ backgroundColor: "var(--graphite-800)", color: "var(--graphite-300)", border: "1px solid var(--graphite-700)" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
