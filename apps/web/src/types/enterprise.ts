export interface Enterprise {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  industry: string;
  fleetSize: string;
  ownerId: string;
  createdAt: string;
}

export type EnterpriseInput = Omit<Enterprise, "id" | "createdAt">;
