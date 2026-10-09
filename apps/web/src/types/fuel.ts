export type FuelMovementTipo = "entrada" | "salida";
export type FuelCategory = "interno" | "planta" | "sindicato" | "tercero" | "compra";

export const FUEL_CATEGORIES: FuelCategory[] = ["interno", "planta", "sindicato", "tercero", "compra"];

export const FUEL_CATEGORY_LABELS: Record<FuelCategory, string> = {
  interno: "Interno (flota/obra)",
  planta: "Planta (despacho asfalto)",
  sindicato: "Sindicato",
  tercero: "Terceros",
  compra: "Compra (ingreso)",
};

export const FUEL_TIPO_LABELS: Record<FuelMovementTipo, string> = {
  entrada: "Ingreso",
  salida: "Egreso",
};

export const DEFAULT_T_L = 1.5;

export interface FuelMovementInput {
  enterpriseId: string;
  fecha: string;
  tipo: FuelMovementTipo;
  categoria: FuelCategory;
  litros: number;
  vehicle_id?: string;
  obra?: string;
  toneladas?: number;
  t_l?: number;
  chofer?: string;
  ci?: string;
  placa?: string;
  talonario?: string;
  proveedor?: string;
  nro_control?: string;
  nro_factura?: string;
  soporte?: string;
  nota?: string;
}

export interface FuelMovement extends FuelMovementInput {
  id: string;
  created_at: string;
  updated_at?: string;
}

export interface FuelCierre {
  previa: number;
  ingresos: number;
  consumo: number;
  existencia: number;
  porCategoria: { interno: number; planta: number; sindicato: number; tercero: number };
  movementsInMonth: FuelMovement[];
}

export function categoriaTipo(categoria: FuelCategory): FuelMovementTipo {
  return categoria === "compra" ? "entrada" : "salida";
}
