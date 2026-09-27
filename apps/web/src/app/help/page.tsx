"use client";

import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";

interface FaqItem {
  q: string;
  a: string;
}

interface DocItem {
  name: string;
  desc?: string;
  formula?: string;
  description?: string;
  requirement?: string;
  steps?: string[];
  example?: string;
}

interface Subsection {
  title: string;
  content?: string;
  desc?: string;
  steps?: string[];
  items?: DocItem[];
}

interface Section {
  id: string;
  title: string;
  content?: string;
  desc?: string;
  steps?: string[];
  faq?: FaqItem[];
  items?: DocItem[];
  subsections?: Subsection[];
}

const sections: Section[] = [
  {
    id: "faq",
    title: "Preguntas frecuentes",
    faq: [
      {
        q: "Necesito conocimientos de mecanica para usar JosTools?",
        a: "No. Cada campo del formulario tiene un icono (?) con ayuda y ejemplos. Solo registras lo que ya sabes: que fallo, cuando, que se hizo y cuanto costo.",
      },
      {
        q: "Quien puede ver la informacion de mi empresa?",
        a: "Solo los usuarios de tu empresa. JosTools aislado los datos por empresa: ninguna otra empresa puede ver tus vehiculos, eventos ni costos, y tu equipo no ve datos de terceros.",
      },
      {
        q: "Cual es la diferencia entre un evento abierto y uno cerrado?",
        a: "Abierto: el vehiculo sigue en el taller; aun no tiene fecha de salida, horas ni costo, y aparece en 'Eventos Abiertos' del dashboard. Cerrado: el vehiculo ya salio, con fecha de salida, horas efectivas y costo completos; ya no aparece en eventos abiertos.",
      },
      {
        q: "Se pueden editar los eventos?",
        a: "Los eventos abiertos si: odometro, fechas, tipo, sistema, componente, accion y causa raiz (Registros, haz click en la fila y pulsa 'Editar'). Los cerrados no se editan desde la interfaz: son definitivos para que los reportes e indicadores no cambien retroactivamente.",
      },
      {
        q: "Como cierro un evento?",
        a: "Desde el dashboard, en 'Eventos Abiertos', pulsa 'Cerrar Evento' y registra la salida, accion, causa, horas y costo. Tambien puedes cerrarlo desde la lista de Registros (boton 'Cerrar') o desde el detalle del evento.",
      },
      {
        q: "Quien puede invitar gente a la empresa?",
        a: "El dueño genera codigos de invitacion de un solo uso desde el menu del navbar, seccion 'Codigo de invitacion'. El invitado entra con Google y usa ese codigo en la pantalla de configuracion, opcion 'Codigo de invitacion'.",
      },
      {
        q: "Como calcula el sistema el MTBF y el MTTR?",
        a: "MTBF: horas efectivas de operacion divididas entre las fallas correctivas. MTTR: promedio entre la fecha de falla y la salida del taller de los eventos correctivos. Se recalculan solos con tus registros; la seccion 'Dashboard e indicadores' trae formulas y ejemplos.",
      },
      {
        q: "Puedo exportar mis datos?",
        a: "Si. En Registros puedes seleccionar eventos y exportarlos en Excel (.xlsx) o PDF, o exportar un evento individual desde su detalle. El dashboard tambien tiene 'Exportar Excel' con eventos e indicadores.",
      },
    ],
  },
  {
    id: "flujo-inicial",
    title: "Flujo inicial (primeros pasos)",
    content:
      "Este es el recorrido completo desde que llegas hasta que trabajas. Si tu usuario aun no tiene empresa, el sistema te lleva automaticamente a la pantalla de configuracion.",
    steps: [
      "Entra con Google: pulsa 'Continuar con Google' en la pantalla de acceso. No creas contrasenas nuevas.",
      "Crea o unete a tu empresa: si eres el dueño, elige 'Crear mi empresa' y ponle nombre. Si te invitaron, elige 'Codigo de invitacion' y pega el codigo de un solo uso que te dio el dueño.",
      "Empieza a registrar: entras al dashboard con tus indicadores. Crea tu primer evento desde 'Nuevo registro' en el navbar y despues consultalo en 'Registros'.",
    ],
  },
  {
    id: "formulario",
    title: "Formulario de registro de eventos",
    content:
      "El formulario 'Nuevo registro' captura un evento de mantenimiento completo. Se abre desde 'Nuevo registro' en el navbar. Los campos con * son obligatorios y los importantes tienen un icono (?) con ayuda contextual.",
    subsections: [
      {
        title: "Campos del formulario",
        items: [
          { name: "Vehiculo *", desc: "Selecciona la matricula del catalogo. Escribe placa, marca o modelo para filtrar la lista. Si el vehiculo aun no existe, crea en el momento con 'Nuevo vehiculo' sin perder lo que ya capturaste." },
          { name: "Odometro / Horas *", desc: "Lectura actual del equipo: kilometros para vehiculos o horas motor para maquinaria. Obligatorio y no puede ser negativo. Usa siempre la misma unidad para comparar entre eventos." },
          { name: "Tipo de evento *", desc: "Correctivo, Preventivo, Inspeccion o Predictivo. Es el principal agrupador de los reportes del dashboard." },
          { name: "Sistema afectado *", desc: "Area del vehiculo donde ocurrio la falla: Motor, Frenos, Electrico, Transmision, etc." },
          { name: "Componente *", desc: "Parte especifica dentro del sistema (pastillas de freno, alternador, bomba de agua...). Mientras mas especifico, mas util es el historial." },
          { name: "Accion realizada *", desc: "Que se hizo para resolver: Reparado, Reemplazado, Ajustado, etc. Registra la intervencion efectivamente realizada." },
          { name: "Causa raiz", desc: "Por que ocurrio la falla: desgaste natural, error del operador, defecto de repuesto... Opcional, pero es la base de las acciones preventivas." },
          { name: "Fecha/Hora de falla *", desc: "Cuando ocurrio o se detecto la falla." },
          { name: "Entrada al taller *", desc: "Cuando ingreso el vehiculo al taller. No puede ser anterior a la fecha de falla." },
          { name: "Salida del taller", desc: "Solo aplica si el evento se guarda cerrado. No puede ser anterior a la entrada." },
          { name: "Horas efectivas y costo", desc: "Solo en eventos cerrados: tiempo real de trabajo del tecnico y costo de la reparacion. Ambos no pueden ser negativos." },
        ],
      },
      {
        title: "Interruptor: evento cerrado o abierto",
        content:
          "Arriba del formulario, junto al tipo de evento, hay un interruptor que define como se guarda el evento:",
        steps: [
          "Activado (por defecto): 'Evento cerrado - el vehiculo ya salio del taller'. Se guarda estado Cerrado con su fecha de salida, horas y costo, y va directo al historial.",
          "Desactivado: 'Evento abierto - el vehiculo no ha salido del taller'. Se guarda sin salida, horas ni costo (estado Abierto), aparece en 'Eventos Abiertos' del dashboard y lo cierras ahi despues.",
          "Al alternarlo se limpian automaticamente la salida, las horas y el costo; la validacion de la fecha de salida solo aplica con el interruptor activado.",
        ],
      },
      {
        title: "Validaciones",
        steps: [
          "Odometro requerido y mayor o igual a 0.",
          "Tipo de evento, sistema afectado, componente, accion realizada y las dos fechas son obligatorios.",
          "La entrada no puede ser anterior a la falla; la salida no puede ser anterior a la entrada.",
          "Las horas y el costo no pueden ser negativos.",
          "Si hay un error, el campo se marca en rojo con su mensaje y el formulario no se envia hasta corregirlo.",
        ],
      },
      {
        title: "Botones",
        items: [
          { name: "Guardar evento", desc: "Valida y guarda el evento; muestra una confirmacion con el registro creado." },
          { name: "Registrar otro", desc: "Guarda y limpia el formulario para capturar el siguiente. Vuelve a poner el interruptor en 'evento cerrado'." },
          { name: "Cancelar", desc: "Regresa al dashboard. Si tienes datos sin guardar, te avisa antes de salir." },
        ],
      },
    ],
  },
  {
    id: "eventos-abiertos",
    title: "Eventos abiertos y cierre",
    content:
      "Mientras un evento este abierto, el vehiculo se considera en taller. Los eventos abiertos no cuentan para MTTR ni MTTF hasta que se cierren.",
    items: [
      { name: "Eventos Abiertos (dashboard)", desc: "Lista los eventos sin cerrar con su vehiculo, tipo y fecha de falla, y el boton 'Cerrar Evento'." },
      { name: "Modal de cierre", desc: "Pide fecha/hora de salida (no anterior a la entrada), accion, causa raiz, horas efectivas y costo." },
      { name: "Al guardar el cierre", desc: "El evento pasa a 'Cerrado': sale de la lista de abiertos, aparece en Registros como cerrado y ya cuenta para MTTR, MTTF y Disponibilidad." },
      { name: "Cierre desde Registros", desc: "Usa el boton 'Cerrar' de la columna Accion de la lista, o entra al detalle del evento y pulsa 'Cerrar Evento'." },
    ],
  },
  {
    id: "registros",
    title: "Registros (bitacora de eventos)",
    content: "La pagina 'Registros' es la bitacora completa de la empresa con busqueda, filtros, orden y exportacion.",
    items: [
      { name: "Busqueda", desc: "Escribe una matricula, tipo de evento o categoria para filtrar la lista al instante." },
      { name: "Filtro por mes", desc: "Selector 'Todos los meses' o un mes especifico (ej: Septiembre 2026). Solo aparecen los meses que tienen eventos." },
      { name: "Columnas ordenables", desc: "Vehiculo, Tipo, Estado, Fecha de falla, Entrada, Salida, Horas, Categoria y Costo. Haz click en un encabezado para ordenar de forma ascendente o descendente." },
      { name: "Seleccion y exportacion", desc: "Marca eventos con los checkboxes (o 'Todas' para seleccionar los visibles). Aparece la barra 'N seleccionados' con 'Exportar seleccion' (elige Excel o PDF) y 'Limpiar'." },
      { name: "Ver detalle", desc: "Haz click en cualquier fila: ves la informacion completa, la duracion en taller, la accion, la causa y el costo del evento." },
      { name: "Acciones del detalle", desc: "Editar y Cerrar Evento (solo si esta abierto), Exportar (Excel o PDF) y Volver." },
      { name: "Edicion de eventos abiertos", desc: "Se editan odometro, fechas, tipo, sistema, componente, accion y causa raiz. La matricula del vehiculo no cambia, y horas y costo se determinan al cierre. Los eventos cerrados muestran un aviso de solo lectura." },
      { name: "Estados", desc: "'Abierto' (amarillo) = vehiculo en taller. 'Cerrado' (verde) = evento finalizado con todos sus datos." },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard e indicadores",
    subsections: [
      {
        title: "Indicadores - explicacion completa",
        content: "Se recalculan automaticamente con tus registros, considerando los filtros de fecha activos.",
        items: [
          {
            name: "MTBF - Tiempo Medio Entre Fallas (Mean Time Between Failures)",
            formula: "MTBF = (T_total_operacion - T_total_inactividad) / N_correctivos",
            description:
              "Mide el tiempo promedio que transcurre entre fallas correctivas. Un MTBF alto significa que el vehiculo falla con menor frecuencia.",
            requirement: "Requiere al menos 1 evento tipo Correctivo.",
            steps: [
              "Se toma la fecha de la primera falla registrada como punto de inicio.",
              "Se calcula el tiempo total de operacion desde esa primera falla hasta la fecha actual (hora actual). Este es el periodo de observacion.",
              "Se suma el tiempo de inactividad de cada evento correctivo: (fecha de salida del taller - fecha de falla). Este es el tiempo que el vehiculo estuvo parado.",
              "Se resta: Tiempo de operacion menos tiempo de inactividad = Tiempo efectivo de funcionamiento.",
              "Se divide entre el numero de eventos correctivos para obtener el promedio.",
            ],
            example:
              "Si un vehiculo tuvo su primera falla hace 300 horas, estuvo parado 40 horas en total, y tuvo 2 fallas correctivas: MTBF = (300 - 40) / 2 = 130 horas entre fallas.",
          },
          {
            name: "MTTR - Tiempo Medio de Reparacion (Mean Time To Repair)",
            formula: "MTTR = Promedio(salida_taller - fecha_falla) de cada evento correctivo",
            description:
              "Mide el tiempo promedio que tarda una reparacion desde que falla hasta que sale del taller. Un MTTR bajo indica eficiencia en el mantenimiento.",
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
            description:
              "Mide la vida util promedio de un componente antes de ser reemplazado. Solo aplica para piezas nuevas que se cambiaron.",
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
            description:
              "Porcentaje del tiempo que el vehiculo esta operativo y disponible. Combina la confiabilidad (MTBF) y la rapidez de reparacion (MTTR).",
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
        title: "Tarjetas del dashboard",
        items: [
          { name: "Eventos Abiertos", desc: "Cantidad de eventos sin cerrar, con acceso directo para cerrarlos." },
          { name: "KPIs", desc: "MTBF, MTTR, MTTF y Disponibilidad del periodo filtrado. Cada tarjeta tiene un (?) que explica su significado." },
          { name: "Resumen", desc: "Totales de eventos, costo acumulado y vehiculos atendidos." },
        ],
      },
      {
        title: "Filtros del dashboard",
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
    ],
  },
  {
    id: "tipos",
    title: "Tipos de evento, acciones y categorias",
    subsections: [
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
        desc: "Cada evento se clasifica en un sistema del vehiculo: Motor, Transmision, Frenos, Electrico, Neumaticos, Suspension, Enfriamiento, Combustible, Escape, Aire acondicionado, Carroceria, Interior u Otro. Las categorias se administran en la seccion de configuracion del sistema.",
      },
    ],
  },
  {
    id: "empresa",
    title: "Empresa y miembros",
    items: [
      { name: "Crear empresa", desc: "Si entras sin empresa, la pantalla de configuracion te pide un nombre. Quien la crea es el dueño." },
      { name: "Codigo de invitacion", desc: "En la pantalla de configuracion, opcion 'Codigo de invitacion': pega el codigo de un solo uso que te dio el dueño para ser integrante de una empresa." },
      { name: "Generar codigos", desc: "El dueño genera codigos desde el menu del navbar, seccion 'Codigo de invitacion'. Cada codigo sirve para una sola persona y caduca al usarse." },
      { name: "Miembros", desc: "El dueño ve la lista de miembros de la empresa y puede expulsar con confirmacion. El historial de membresias se conserva." },
      { name: "Cambiar de empresa", desc: "El menu del navbar muestra las empresas a las que perteneces y te permite cambiar entre ellas o crear otra." },
      { name: "Permisos", desc: "Todos los miembros registran eventos, ven el dashboard y exportan. El dueño ademas administra miembros e invitaciones." },
    ],
  },
  {
    id: "exportacion",
    title: "Exportacion de reportes",
    items: [
      { name: "Excel desde el dashboard", desc: "El boton 'Exportar Excel' descarga un archivo .xlsx con los eventos filtrados y una hoja de indicadores calculados." },
      { name: "Excel o PDF desde Registros", desc: "Selecciona eventos con los checkboxes y usa 'Exportar seleccion', o exporta un evento individual desde su detalle." },
      { name: "Formato del PDF", desc: "Tabla horizontal con vehiculo, tipo, estado, fechas, horas, categoria, componente, accion, causa y costo, con encabezado JosTools y fecha de generacion." },
      { name: "Contenido del Excel", desc: "Dos hojas: 'Eventos' con los registros filtrados y 'Indicadores' con MTBF, MTTR, MTTF, Disponibilidad y total de eventos." },
    ],
  },
];

function renderItems(items: DocItem[]) {
  return items.map((item, j) => (
    <div key={j} className="mb-5 last:mb-0">
      {item.formula ? (
        <div className="rounded-xl p-5" style={{ backgroundColor: "var(--graphite-800)" }}>
          <h3 className="text-sm font-bold mb-2" style={{ color: "var(--graphite-100)" }}>{item.name}</h3>
          <div className="mb-3 px-3 py-2 rounded-lg text-xs font-mono" style={{ backgroundColor: "var(--graphite-900)", color: "var(--ash-grey-400)" }}>{item.formula}</div>
          <p className="text-sm mb-3" style={{ color: "var(--graphite-300)" }}>{item.description}</p>
          {item.requirement && (
            <p className="text-xs mb-3 font-medium" style={{ color: "var(--tuscan-sun-400)" }}>Requisito: {item.requirement}</p>
          )}
          {item.steps && (
            <div className="mb-3">
              <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "var(--graphite-500)" }}>Paso a paso:</p>
              <ol className="space-y-1.5">
                {item.steps.map((step, k) => (
                  <li key={k} className="flex items-start gap-2 text-xs" style={{ color: "var(--graphite-400)" }}>
                    <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>{k + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {item.example && (
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
            {item.desc && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--graphite-400)" }}>{item.desc}</p>}
          </div>
        </div>
      )}
    </div>
  ));
}

function renderSteps(steps: string[]) {
  return (
    <ol className="space-y-3">
      {steps.map((step, j) => (
        <li key={j} className="flex items-start gap-3 text-sm" style={{ color: "var(--graphite-300)" }}>
          <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>{j + 1}</span>
          <span className="leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export default function HelpPage() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: "var(--graphite-950)" }}>
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold" style={{ color: "var(--graphite-50)" }}>Ayuda y documentacion</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--graphite-400)" }}>Guia completa del sistema de mantenimiento de flotas: desde el primer acceso hasta los reportes.</p>
          </div>

          {/* Indice */}
          <div className="rounded-2xl border p-6 mb-10" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--tuscan-sun-400)" }}>Indice</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sections.map((section, i) => (
                <button
                  key={section.id}
                  onClick={() => scrollTo(section.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left cursor-pointer transition-all hover:opacity-80"
                  style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-700)", color: "var(--graphite-300)" }}
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>{i + 1}</span>
                  {section.title}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            {sections.map((section) => (
              <div key={section.id} id={section.id} className="rounded-2xl border p-6 scroll-mt-24" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
                <h2 className="text-lg font-bold mb-4" style={{ color: "var(--tuscan-sun-400)" }}>{section.title}</h2>

                {section.content && (
                  <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--graphite-300)" }}>{section.content}</p>
                )}

                {section.desc && !section.items && (
                  <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--graphite-300)" }}>{section.desc}</p>
                )}

                {section.steps && <div className="mt-4">{renderSteps(section.steps)}</div>}

                {section.faq && (
                  <div className="space-y-4">
                    {section.faq.map((item, j) => (
                      <div key={j} className="rounded-xl p-4" style={{ backgroundColor: "var(--graphite-800)" }}>
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>?</span>
                          <div>
                            <p className="text-sm font-semibold mb-1.5" style={{ color: "var(--graphite-100)" }}>{item.q}</p>
                            <p className="text-xs leading-relaxed" style={{ color: "var(--graphite-400)" }}>{item.a}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {section.items && <div className="mt-4">{renderItems(section.items)}</div>}

                {section.subsections && (
                  <div className="space-y-6 mt-2">
                    {section.subsections.map((sub, j) => (
                      <div key={j} className="pt-5" style={{ borderTop: j > 0 ? "1px solid var(--graphite-800)" : "none" }}>
                        <h3 className="text-sm font-bold mb-3 uppercase tracking-wider" style={{ color: "var(--graphite-100)" }}>{sub.title}</h3>
                        {sub.content && (
                          <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--graphite-300)" }}>{sub.content}</p>
                        )}
                        {sub.desc && !sub.items && (
                          <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--graphite-300)" }}>{sub.desc}</p>
                        )}
                        {sub.steps && <div className="mb-3">{renderSteps(sub.steps)}</div>}
                        {sub.items && renderItems(sub.items)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
