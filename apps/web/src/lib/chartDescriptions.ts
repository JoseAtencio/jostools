export const CHART_DESCRIPTIONS = {
  eventType:
    "Reparto de los eventos del periodo por tipo: correctivos, preventivos, inspecciones y predictivos. Un alto porcentaje de correctivos indica que la flota esta fallando mas de lo previsto.",
  monthly:
    "Eventos registrados en cada mes del periodo. Sirve para ver si la carga de taller sube o baja y si el mantenimiento preventivo esta compensando las fallas.",
  trend:
    "Evolucion mensual de MTBF (horas promedio entre fallas) y MTTR (horas promedio de reparacion). Si el MTBF sube y el MTTR baja, la confiabilidad de la flota mejora.",
  cost:
    "Costo de las reparaciones por sistema del vehiculo. Muestra donde se concentra el gasto y que sistema conviene prevenir.",
  topVehicles:
    "Vehiculos con mas eventos en el periodo. Orienta el focus de mantenimiento: los que mas fallan suelen necesitar un plan preventivo o una revision.",
} as const;
