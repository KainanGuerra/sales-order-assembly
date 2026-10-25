import { z } from 'zod';

export const SearchProductsQuerySchema = z.object({
  // Absent: browse the catalog by name instead of searching.
  q: z.string().trim().min(1).max(80).optional(),
  // The client's price table. Absent when the caller has none to offer.
  priceTableId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // Only used when browsing: how many products to skip.
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
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
