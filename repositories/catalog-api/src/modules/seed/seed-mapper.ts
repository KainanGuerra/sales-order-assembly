import { z } from 'zod';

// Reads only the slice of seed.json that belongs to the catalog. Unknown
// fields are ignored: the file belongs to the other services as well.
const SeedProductSchema = z.object({
  id: z.string().min(1),
  sku: z.string().min(1),
  ean: z.string().min(1),
  descricao: z.string().min(1),
  categoria: z.string(),
  marca: z.string(),
  unidade_venda: z.string().min(1),
  fator_embalagem: z.number().int().positive(),
  venda_somente_multiplo: z.boolean(),
  ativo: z.boolean(),
});

const SeedPriceTableSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  itens: z.array(
    z.object({
      produto_id: z.string().min(1),
      preco_unidade: z.number().positive(),
    }),
  ),
});

export const CatalogSeedSchema = z.object({
  produtos: z.array(SeedProductSchema),
  tabelas_preco: z.array(SeedPriceTableSchema),
});

export interface ProductSeedRow {
  id: string;
  sku: string;
  ean: string;
  description: string;
  category: string;
  brand: string;
  saleUnit: string;
  packFactor: number;
  multipleOnly: boolean;
  active: boolean;
}

export interface PriceTableSeedRow {
  id: string;
  name: string;
}

export interface PriceItemSeedRow {
  priceTableId: string;
  productId: string;
  unitPriceCents: number;
}

export interface CatalogSeed {
  products: ProductSeedRow[];
  priceTables: PriceTableSeedRow[];
  priceItems: PriceItemSeedRow[];
}

// The seed has prices in reais as floats (26.9). Rounding to the nearest cent
// absorbs the float noise (26.9 * 100 is 2690.0000000000005).
export function toCents(reais: number): number {
  return Math.round(reais * 100);
}

export function mapCatalogSeed(raw: unknown): CatalogSeed {
  const seed = CatalogSeedSchema.parse(raw);
  const productIds = new Set(seed.produtos.map((p) => p.id));

  return {
    products: seed.produtos.map((p) => ({
      id: p.id,
      sku: p.sku,
      ean: p.ean,
      description: p.descricao,
      category: p.categoria,
      brand: p.marca,
      saleUnit: p.unidade_venda,
      packFactor: p.fator_embalagem,
      multipleOnly: p.venda_somente_multiplo,
      active: p.ativo,
    })),
    priceTables: seed.tabelas_preco.map((t) => ({ id: t.id, name: t.nome })),
    priceItems: seed.tabelas_preco.flatMap((t) =>
      t.itens.map((item) => {
        if (!productIds.has(item.produto_id)) {
          throw new Error(`Price table ${t.id} references unknown product ${item.produto_id}`);
        }
        return {
          priceTableId: t.id,
          productId: item.produto_id,
          unitPriceCents: toCents(item.preco_unidade),
        };
      }),
    ),
  };
}
