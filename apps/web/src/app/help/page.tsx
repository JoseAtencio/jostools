"use client";

import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";

const sections = [
  {
    title: "Que es JosTools?",
    content: "JosTools es una herramienta web para el mantenimiento de flotas vehiculares. Permite registrar eventos de mantenimiento (correctivos, preventivos e inspecciones) y calcular automaticamente indicadores de confiabilidad: MTBF, MTTR, MTTF y Disponibilidad.",
  },
  {
    title: "Como funciona?",
    steps: [
      "Registra un evento de mantenimiento desde 'Nuevo registro' con los datos del vehiculo, taller y tipo de falla.",
      "El sistema almacena el evento en la base de datos (Firestore).",
      "El Dashboard calcula automaticamente los indicadores con los registros existentes.",
      "Puedes filtrar por fecha, tipo de evento, vehiculo o categoria para analizar periodos especificos.",
      "Exporta los datos a Excel con el boton 'Exportar Excel'.",
    ],
  },
  {
    title: "Indicadores - Explicacion completa",
    items: [
      {
        name: "MTBF - Tiempo Medio Entre Fallas (Mean Time Between Failures)",
        formula: "MTBF = (T_total_operacion - T_total_inactividad) / N_correctivos",
        description: "Mide el tiempo promedio que transcurre entre fallas correctivas. Un MTBF alto significa que el vehiculo falla con menor frecuencia.",
        requirement: "Requiere al menos 1 evento tipo Correctivo.",
        steps: [
          "Se toma la fecha de la primera falla registrada como punto de inicio.",
          "Se calcula el tiempo total de operacion desde esa primera falla hasta la fecha actual (hora actual). Este es el periodo de observacion.",
          "Se suma el tiempo de inactividad de cada evento correctivo: (fecha de salida del taller - fecha de falla). Este es el tiempo que el vehiculo estuvo parado.",
          "Se resta: Tiempo de operacion menos tiempo de inactividad = Tiempo efectivo de funcionamiento.",
          "Se divide entre el numero de eventos correctivos para obtener el promedio.",
        ],
        example: "Si un vehiculo tuvo su primera falla hace 300 horas, estuvo parado 40 horas en total, y tuvo 2 fallas correctivas: MTBF = (300 - 40) / 2 = 130 horas entre fallas.",
      },
      {
        name: "MTTR - Tiempo Medio de Reparacion (Mean Time To Repair)",
        formula: "MTTR = Promedio(salida_taller - fecha_falla) de cada evento correctivo",
        description: "Mide el tiempo promedio que tarda una reparacion desde que falla hasta que sale del taller. Un MTTR bajo indica eficiencia en el mantenimiento.",
        requirement: "Requiere al menos 1 evento tipo Correctivo.",
        steps: [
          "Para cada evento correctivo, se calcula: (fecha de salida del taller) menos (fecha de falla). Esto incluye tiempo de diagnostico, espera de repuestos y reparacion.",
          "Se suman todos esos tiempos y se divide entre el numero de eventos correctivos.",
        ],
        example: "Si hubo 2 reparaciones que tardaron 24h y 36h: MTTR = (24 + 36) / 2 = 30 horas promedio de reparacion.",
      },
      {
        name: "MTTF - Tiempo Medio Hasta la Falla (Mean Time To Failure)",
        formula: "MTTF = Promedio(horas_efectivas) de eventos con accion REPLACED",
        description: "Mide la vida util promedio de un componente antes de ser reemplazado. Solo aplica para piezas nuevas que se cambiaron.",
        requirement: "Requiere eventos con accion 'Reemplazado (Pieza nueva)'.",
        steps: [
          "Se filtran los eventos donde la accion tomada fue 'Reemplazado (Pieza nueva)'.",
          "De cada uno se toman las 'horas efectivas de trabajo' del componente.",
          "Se promedian esas horas para obtener el MTTF.",
        ],
        example: "Si se reemplazaron 2 filtros de aceite con 500h y 700h de vida: MTTF = (500 + 700) / 2 = 600 horas de vida util promedio.",
      },
      {
        name: "Disponibilidad Operativa",
        formula: "Disponibilidad = MTBF / (MTBF + MTTR) x 100",
        description: "Porcentaje del tiempo que el vehiculo esta operativo y disponible. Combina la confiabilidad (MTBF) y la rapidez de reparacion (MTTR).",
        requirement: "Requiere que MTBF y MTTR esten calculados (minimo 1 evento correctivo).",
        steps: [
          "Se toma el MTBF (tiempo promedio entre fallas).",
          "Se toma el MTTR (tiempo promedio de reparacion).",
          "Se aplica la formula: MTBF dividido entre (MTBF + MTTR), multiplicado por 100.",
          "Un valor del 95% o mas es considerado excelente. Un valor menor al 85% indica problemas de confiabilidad o eficiencia.",
        ],
        example: "Si MTBF = 130h y MTTR = 30h: Disponibilidad = 130 / (130 + 30) x 100 = 81.25%. El vehiculo esta operativo el 81.25% del tiempo.",
      },
    ],
  },
  {
    title: "Tipos de evento",
    items: [
      { name: "Correctivo (Falla imprevista)", desc: "Reparacion no programada por una falla inesperada. Es el tipo principal para calcular MTBF y MTTR." },
      { name: "Preventivo (Mantenimiento programado)", desc: "Mantenimiento programado para prevenir fallas. No afecta los indicadores de confiabilidad." },
      { name: "Inspeccion", desc: "Revision periodica del vehiculo. No afecta los indicadores de confiabilidad." },
      { name: "Predictivo (Monitoreo de condicion)", desc: "Intervencion basada en mediciones o sintomas detectados antes de la falla (vibracion, temperatura, etc). No afecta los indicadores de confiabilidad." },
    ],
  },
  {
    title: "Acciones de reparacion",
    items: [
      { name: "Reparado (Pieza existente)", desc: "Se arreglo la pieza sin reemplazarla." },
      { name: "Reemplazado (Pieza nueva)", desc: "Se cambio la pieza por una nueva. Se usa para calcular MTTF." },
      { name: "Ajustado", desc: "Se ajusto o calibro el componente." },
    ],
  },
  {
    title: "Categorias del sistema",
    desc: "Cada evento se clasifica en una categoria del vehiculo: Motor, Transmision, Frenos, Electrico, Neumaticos, Suspension u Otro.",
  },
  {
    title: "Filtros del Dashboard",
    items: [
      { name: "Fecha rapida", desc: "Botones: Este mes, Esta semana, Este dia, Todos los dias. Filtran los registros por rango de fechas." },
      { name: "Tipo de evento", desc: "Filtra por Correctivo, Preventivo, Inspeccion o Predictivo." },
      { name: "Vehiculo", desc: "Filtra por un vehiculo especifico." },
      { name: "Categoria", desc: "Filtra por categoria del sistema (Motor, Frenos, etc)." },
      { name: "Graficas interactivas", desc: "Haz click en cualquier grafica para aplicar un filtro rapido. Aparecera un chip con el filtro activo." },
    ],
  },
  {
    title: "Graficas",
    items: [
      { name: "Distribucion por tipo", desc: "Grafica circular (dona) que muestra la proporcion de eventos por tipo." },
      { name: "Eventos por mes", desc: "Grafica de barras con el numero de eventos registrados por mes." },
      { name: "Tendencia MTBF/MTTR", desc: "Grafica de lineas que muestra la evolucion mensual de MTBF y MTTR." },
      { name: "Costo por categoria", desc: "Grafica de barras con el costo total de reparaciones por categoria." },
      { name: "Top 5 vehiculos con mas fallas", desc: "Grafica de barras con los vehiculos que mas fallas han tenido." },
    ],
  },
  {
    title: "Exportar a Excel",
    desc: "El boton 'Exportar Excel' genera un archivo .xlsx con dos hojas: una con todos los eventos filtrados y otra con los indicadores calculados.",
  },
];

export default function HelpPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: "var(--graphite-950)" }}>
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-10">
          <div className="mb-10">
            <h1 className="text-3xl font-bold" style={{ color: "var(--graphite-50)" }}>Ayuda - JosTools</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--graphite-400)" }}>Guia completa del sistema de mantenimiento de flotas</p>
          </div>

          <div className="space-y-8">
            {sections.map((section, i) => (
              <div key={i} className="rounded-2xl border p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <h2 className="text-lg font-bold mb-4" style={{ color: "var(--tuscan-sun-400)" }}>{section.title}</h2>

                {section.content && (
                  <p className="text-sm leading-relaxed" style={{ color: "var(--graphite-300)" }}>{section.content}</p>
                )}

                {section.desc && !section.items && (
                  <p className="text-sm leading-relaxed" style={{ color: "var(--graphite-300)" }}>{section.desc}</p>
                )}

                {section.steps && (
                  <ol className="space-y-3">
                    {section.steps.map((step, j) => (
                      <li key={j} className="flex items-start gap-3 text-sm" style={{ color: "var(--graphite-300)" }}>
                        <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>{j + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                )}

                {section.items && section.items.map((item, j) => (
                  <div key={j} className="mb-5 last:mb-0">
                    {"formula" in item ? (
                      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--graphite-800)" }}>
                        <h3 className="text-sm font-bold mb-2" style={{ color: "var(--graphite-100)" }}>{item.name}</h3>
                        <div className="mb-3 px-3 py-2 rounded-lg text-xs font-mono" style={{ backgroundColor: "var(--graphite-900)", color: "var(--ash-grey-400)" }}>{item.formula}</div>
                        <p className="text-sm mb-3" style={{ color: "var(--graphite-300)" }}>{item.description}</p>
                        {"requirement" in item && item.requirement && (
                          <p className="text-xs mb-3 font-medium" style={{ color: "var(--tuscan-sun-400)" }}>Requisito: {item.requirement}</p>
                        )}
                        {"steps" in item && item.steps && (
                          <div className="mb-3">
                            <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "var(--graphite-500)" }}>Paso a paso:</p>
                            <ol className="space-y-1.5">
                              {item.steps.map((step: string, k: number) => (
                                <li key={k} className="flex items-start gap-2 text-xs" style={{ color: "var(--graphite-400)" }}>
                                  <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>{k + 1}</span>
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {"example" in item && item.example && (
                          <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "rgba(0, 81, 255, 0.1)", border: "1px solid rgba(0, 81, 255, 0.2)", color: "var(--crayola-blue-400)" }}>
                            <span className="font-bold">Ejemplo: </span>{item.example}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: "var(--tuscan-sun-500)" }} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: "var(--graphite-100)" }}>{item.name}</p>
                          {"desc" in item && <p className="text-xs mt-0.5" style={{ color: "var(--graphite-400)" }}>{item.desc}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
