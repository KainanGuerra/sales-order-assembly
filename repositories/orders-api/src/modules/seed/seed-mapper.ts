import { createHash } from 'node:crypto';
import { z } from 'zod';
import { divideRoundHalfUp } from '../orders/domain/order-rules.js';

// The history orders that come with the seed, turned into orders. Everything an
// order stores is in the file already (names, supervisor, product data), so no
// other service is needed. The file's own words for status are mapped to ours:
// "Faturado" is INVOICED and "Cancelado" is CANCELLED.

const SeedSchema = z.object({
  vendedores: z.array(z.object({ id: z.string(), nome: z.string(), supervisor_id: z.string() })),
  clientes: z.array(z.object({ id: z.string(), nome_fantasia: z.string(), tabela_preco_id: z.string().nullable() })),
  produtos: z.array(z.object({ id: z.string(), sku: z.string(), descricao: z.string(), fator_embalagem: z.number().int().positive() })),
  pedidos_historico: z.array(
    z.object({
      id: z.string(),
      cliente_id: z.string(),
      vendedor_id: z.string(),
      data: z.iso.date(),
      status: z.string(),
      itens: z.array(
        z.object({
          produto_id: z.string(),
          quantidade: z.number().int().positive(),
          preco_unidade: z.number().positive(),
          desconto_percentual: z.number().min(0).max(100),
        }),
      ),
    }),
  ),
});

const STATUS_OF: Record<string, 'INVOICED' | 'CANCELLED'> = { Faturado: 'INVOICED', Cancelado: 'CANCELLED' };

// The seed ids ("PH001") are not UUIDs, but an order's id is. A name-based UUID
// (version 5) is the same every time, so importing twice finds the same orders.
const NAMESPACE = '6f1d5c1e-5b7a-4b0e-9a55-0c7f1c9e2a11';
export function deterministicUuid(name: string): string {
  const namespace = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(namespace).update(name).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface ImportedOrder {
  order: {
    id: string;
    sellerId: string;
    sellerName: string;
    supervisorId: string;
    clientId: string;
    clientTradeName: string;
    priceTableId: string;
    status: 'INVOICED' | 'CANCELLED';
    origin: 'IMPORTED';
    subtotalCents: number;
    orderDiscountBp: number;
    orderDiscountCents: number;
    totalCents: number;
    approvalReasons: [];
    createdAt: Date;
  };
  items: {
    orderId: string;
    productId: string;
    sku: string;
    description: string;
    unit: 'UNIT';
    quantityInput: number;
    quantityUnits: number;
    packFactor: number;
    unitPriceCents: number;
    discountBp: number;
    grossCents: number;
    netCents: number;
  }[];
  history: { status: 'INVOICED' | 'CANCELLED'; actor: string; createdAt: Date };
}

export function mapHistoryOrders(raw: unknown, defaultPriceTableId: string): ImportedOrder[] {
  const seed = SeedSchema.parse(raw);
  const sellers = new Map(seed.vendedores.map((v) => [v.id, v]));
  const clients = new Map(seed.clientes.map((c) => [c.id, c]));
  const products = new Map(seed.produtos.map((p) => [p.id, p]));

  return seed.pedidos_historico.map((h) => {
    const status = STATUS_OF[h.status];
    if (!status) {
      throw new Error(`History order ${h.id} has the unknown status "${h.status}"`);
    }
    const seller = sellers.get(h.vendedor_id);
    const client = clients.get(h.cliente_id);
    if (!seller || !client) {
      throw new Error(`History order ${h.id} references an unknown seller or client`);
    }

    const id = deterministicUuid(h.id);
    // Noon UTC, so the day is the same in every time zone of the country.
    const at = new Date(`${h.data}T12:00:00.000Z`);

    const items = h.itens.map((item) => {
      const product = products.get(item.produto_id);
      if (!product) {
        throw new Error(`History order ${h.id} references the unknown product ${item.produto_id}`);
      }
      // The same rounding as a live order: each line once, half up.
      const unitPriceCents = Math.round(item.preco_unidade * 100);
      const discountBp = Math.round(item.desconto_percentual * 100);
      const grossCents = unitPriceCents * item.quantidade;
      return {
        orderId: id,
        productId: product.id,
        sku: product.sku,
        description: product.descricao,
        unit: 'UNIT' as const,
        quantityInput: item.quantidade,
        quantityUnits: item.quantidade,
        packFactor: product.fator_embalagem,
        unitPriceCents,
        discountBp,
        grossCents,
        netCents: divideRoundHalfUp(grossCents * (10_000 - discountBp), 10_000),
      };
    });

    const subtotalCents = items.reduce((sum, item) => sum + item.netCents, 0);
    return {
      order: {
        id,
        sellerId: seller.id,
        sellerName: seller.nome,
        supervisorId: seller.supervisor_id,
        clientId: client.id,
        clientTradeName: client.nome_fantasia,
        priceTableId: client.tabela_preco_id ?? defaultPriceTableId,
        status,
        origin: 'IMPORTED' as const,
        subtotalCents,
        orderDiscountBp: 0,
        orderDiscountCents: 0,
        totalCents: subtotalCents,
        approvalReasons: [] as [],
        createdAt: at,
      },
      items,
      history: { status, actor: 'system:import', createdAt: at },
    };
  });
}
