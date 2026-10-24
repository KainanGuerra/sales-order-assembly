import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { DB, type Database } from '../../../db/database.module.js';
import { priceTableItems, products } from '../../../db/schema.js';
import { isExactCodeQuery, type ProductRow } from '../search-rules.js';

// Wrapped in a function so the same expression is used by the index, the
// filter and the ranking.
const normalizedDescription = sql`immutable_unaccent(lower(${products.description}))`;

// "%" and "_" are wildcards in LIKE; the seller's text is literal.
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const columns = {
  id: products.id,
  sku: products.sku,
  ean: products.ean,
  description: products.description,
  saleUnit: products.saleUnit,
  packFactor: products.packFactor,
  multipleOnly: products.multipleOnly,
  active: products.active,
  unitPriceCents: priceTableItems.unitPriceCents,
};

@Injectable()
export class ProductsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  // Returns the best matches first. Visibility rules (inactive, no price) are
  // applied by the service, so this only does the matching.
  async search(query: string, priceTableId: string | null, limit: number): Promise<ProductRow[]> {
    const text = query.trim();
    const withPrice = this.db
      .select(columns)
      .from(products)
      // Left join: a product missing from the table still comes back, with a null price.
      .leftJoin(
        priceTableItems,
        and(eq(priceTableItems.productId, products.id), eq(priceTableItems.priceTableId, priceTableId ?? '')),
      );

    if (isExactCodeQuery(text)) {
      return withPrice
        .where(sql`${products.ean} = ${text} or upper(${products.sku}) = upper(${text})`)
        .orderBy(asc(products.id))
        .limit(limit);
    }

    const normalizedQuery = sql`immutable_unaccent(lower(${text}))`;
    const contains = sql`${normalizedDescription} like ${'%' + escapeLike(text.toLowerCase()) + '%'}`;
    // "<%" is pg_trgm's word-similarity operator: the query only has to resemble
    // one word of the description, so a short, misspelt query ("arros") still
    // finds a long description. Plain similarity would compare whole strings.
    const similar = sql`${normalizedQuery} <% ${normalizedDescription}`;

    return withPrice
      .where(sql`(${contains}) or (${similar})`)
      .orderBy(
        // Exact description first, then the closest match, then a stable order
        // that also decides between the two products sharing an EAN.
        desc(sql`${normalizedDescription} = ${normalizedQuery}`),
        desc(sql`word_similarity(${normalizedQuery}, ${normalizedDescription})`),
        asc(products.id),
      )
      .limit(limit);
  }

  async findByIds(ids: string[], priceTableId: string): Promise<ProductRow[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.db
      .select(columns)
      .from(products)
      .leftJoin(
        priceTableItems,
        and(eq(priceTableItems.productId, products.id), eq(priceTableItems.priceTableId, priceTableId)),
      )
      .where(inArray(products.id, ids));
  }
}
