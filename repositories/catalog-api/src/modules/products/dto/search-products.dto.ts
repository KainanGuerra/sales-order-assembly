import { z } from 'zod';

export const SearchProductsQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  // The client's price table. Absent when the caller has none to offer.
  priceTableId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchProductsQuery = z.infer<typeof SearchProductsQuerySchema>;

export interface ProductSearchItem {
  id: string;
  sku: string;
  ean: string;
  description: string;
  saleUnit: string;
  packFactor: number;
  multipleOnly: boolean;
  availability: 'AVAILABLE' | 'NO_PRICE' | 'INACTIVE';
  // Null unless the product can be sold.
  unitPriceCents: number | null;
  reason: 'DISCONTINUED' | 'NO_PRICE_IN_TABLE' | null;
}
