import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../../config/env.js';
import type { ProductSearchItem, SearchProductsQuery } from '../dto/search-products.dto.js';
import { ProductsRepository } from '../repository/products.repository.js';
import { classify, isVisible, matchesExactCode, reasonFor, isExactCodeQuery, type ProductRow } from '../search-rules.js';

// Candidates fetched before visibility filtering; the final page is cut after.
const CANDIDATE_LIMIT = 100;

@Injectable()
export class ProductsService {
  constructor(
    private readonly repository: ProductsRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async search({ q, priceTableId, limit }: Pick<SearchProductsQuery, 'priceTableId' | 'limit'> & { q: string }): Promise<ProductSearchItem[]> {
    const rows = await this.repository.search(q, priceTableId ?? null, CANDIDATE_LIMIT);
    const exactCode = isExactCodeQuery(q);

    return rows
      .map((row) => ({ row, availability: classify(row) }))
      .filter(({ row, availability }) =>
        isVisible(availability, exactCode && matchesExactCode(q, row), this.env.SHOW_UNAVAILABLE_PRODUCTS),
      )
      .slice(0, limit)
      .map(({ row, availability }) => toSearchItem(row, availability));
  }

  // The catalog by name, one page at a time. Inactive products are not listed
  // (they only show for an exact EAN/SKU); an active product missing from the
  // table is listed, disabled, only when the flag is on, like in a search.
  async browse({ priceTableId, limit, offset }: Pick<SearchProductsQuery, 'priceTableId' | 'limit' | 'offset'>): Promise<ProductSearchItem[]> {
    const rows = await this.repository.browse(priceTableId ?? null, this.env.SHOW_UNAVAILABLE_PRODUCTS, limit, offset);
    return rows.map((row) => toSearchItem(row, classify(row)));
  }

  async findQuotes(productIds: string[], priceTableId: string) {
    const rows = await this.repository.findByIds(productIds, priceTableId);
    const found = new Set(rows.map((row) => row.id));
    return {
      products: rows,
      unknownProductIds: productIds.filter((id) => !found.has(id)),
    };
  }
}

function toSearchItem(row: ProductRow, availability: ReturnType<typeof classify>): ProductSearchItem {
  return {
    id: row.id,
    sku: row.sku,
    ean: row.ean,
    description: row.description,
    saleUnit: row.saleUnit,
    packFactor: row.packFactor,
    multipleOnly: row.multipleOnly,
    availability,
    // An inactive product keeps no price: it cannot be sold.
    unitPriceCents: availability === 'AVAILABLE' ? row.unitPriceCents : null,
    reason: reasonFor(availability),
  };
}
