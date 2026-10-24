import { z } from 'zod';

export const ValidatePickSchema = z.object({
  role: z.enum(['SELLER', 'SUPERVISOR']),
  id: z.string().trim().min(1).max(40),
});
export type ValidatePick = z.infer<typeof ValidatePickSchema>;

export interface UserProfile {
  role: 'SELLER' | 'SUPERVISOR';
  id: string;
  name: string;
  // Present for a seller.
  supervisorId?: string;
  discountLimitBp?: number;
}

export interface LoginOptions {
  supervisors: { id: string; name: string }[];
  sellers: { id: string; name: string }[];
}

export interface ClientView {
  id: string;
  tradeName: string;
  legalName: string;
  cnpj: string;
  city: string;
  state: string;
  sellerId: string;
  priceTableId: string;
  // True when the client has no table of its own and the default is used.
  priceTableFallback: boolean;
  creditLimitCents: number;
  creditUsedCents: number;
  creditAvailableCents: number;
}
