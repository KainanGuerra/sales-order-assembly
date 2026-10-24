import { z } from 'zod';

// Reads only the slice of seed.json that belongs to identity. Unknown fields
// are ignored: the file is shared with the other services.
const SeedSchema = z.object({
  supervisores: z.array(z.object({ id: z.string().min(1), nome: z.string().min(1) })),
  vendedores: z.array(
    z.object({
      id: z.string().min(1),
      nome: z.string().min(1),
      supervisor_id: z.string().min(1),
      alcada_desconto_percentual: z.number().min(0).max(100),
    }),
  ),
  clientes: z.array(
    z.object({
      id: z.string().min(1),
      nome_fantasia: z.string().min(1),
      razao_social: z.string().min(1),
      cnpj: z.string().min(1),
      vendedor_id: z.string().min(1),
      tabela_preco_id: z.string().min(1).nullable(),
      limite_credito: z.number().min(0),
      credito_utilizado: z.number().min(0),
      cidade: z.string(),
      uf: z.string(),
    }),
  ),
});

export interface IdentitySeed {
  supervisors: { id: string; name: string }[];
  sellers: { id: string; name: string; supervisorId: string; discountLimitBp: number }[];
  clients: {
    id: string;
    tradeName: string;
    legalName: string;
    cnpj: string;
    sellerId: string;
    priceTableId: string | null;
    creditLimitCents: number;
    creditUsedCents: number;
    city: string;
    state: string;
  }[];
}

// Seed money is in reais and discounts in whole percent. Rounding absorbs float noise.
export const toCents = (reais: number) => Math.round(reais * 100);
export const toBasisPoints = (percent: number) => Math.round(percent * 100);

export function mapIdentitySeed(raw: unknown): IdentitySeed {
  const seed = SeedSchema.parse(raw);
  const supervisorIds = new Set(seed.supervisores.map((s) => s.id));
  const sellerIds = new Set(seed.vendedores.map((s) => s.id));

  return {
    supervisors: seed.supervisores.map((s) => ({ id: s.id, name: s.nome })),
    sellers: seed.vendedores.map((s) => {
      if (!supervisorIds.has(s.supervisor_id)) {
        throw new Error(`Seller ${s.id} references unknown supervisor ${s.supervisor_id}`);
      }
      return {
        id: s.id,
        name: s.nome,
        supervisorId: s.supervisor_id,
        discountLimitBp: toBasisPoints(s.alcada_desconto_percentual),
      };
    }),
    clients: seed.clientes.map((c) => {
      if (!sellerIds.has(c.vendedor_id)) {
        throw new Error(`Client ${c.id} references unknown seller ${c.vendedor_id}`);
      }
      return {
        id: c.id,
        tradeName: c.nome_fantasia,
        legalName: c.razao_social,
        cnpj: c.cnpj,
        sellerId: c.vendedor_id,
        priceTableId: c.tabela_preco_id,
        creditLimitCents: toCents(c.limite_credito),
        creditUsedCents: toCents(c.credito_utilizado),
        city: c.cidade,
        state: c.uf,
      };
    }),
  };
}
