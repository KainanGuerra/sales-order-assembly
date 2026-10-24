// Pure rules for what a seller sees when searching. No I/O, so every branch is
// covered by plain unit tests.

export type Availability = 'AVAILABLE' | 'NO_PRICE' | 'INACTIVE';
export type UnavailableReason = 'DISCONTINUED' | 'NO_PRICE_IN_TABLE';

export interface ProductRow {
  id: string;
  sku: string;
  ean: string;
  description: string;
  saleUnit: string;
  packFactor: number;
  multipleOnly: boolean;
  active: boolean;
  // Null when the product is missing from the requested price table.
  unitPriceCents: number | null;
}

export function classify(product: Pick<ProductRow, 'active' | 'unitPriceCents'>): Availability {
  if (!product.active) {
    return 'INACTIVE';
  }
  return product.unitPriceCents === null ? 'NO_PRICE' : 'AVAILABLE';
}

export function reasonFor(availability: Availability): UnavailableReason | null {
  switch (availability) {
    case 'INACTIVE':
      return 'DISCONTINUED';
    case 'NO_PRICE':
      return 'NO_PRICE_IN_TABLE';
    case 'AVAILABLE':
      return null;
  }
}

// EAN-8, UPC-A, EAN-13 and GTIN-14 are all digit-only strings.
const EAN_PATTERN = /^\d{8,14}$/;
const SKU_PATTERN = /^SKU-\d+$/i;

export function isExactCodeQuery(query: string): boolean {
  const q = query.trim();
  return EAN_PATTERN.test(q) || SKU_PATTERN.test(q);
}

export function matchesExactCode(query: string, product: Pick<ProductRow, 'ean' | 'sku'>): boolean {
  const q = query.trim();
  return q === product.ean || q.toUpperCase() === product.sku.toUpperCase();
}

// Which products appear in the results.
//  - Available products always do.
//  - Active products without a price in the client's table appear (disabled,
//    with the reason) only when the flag is on.
//  - Inactive products never appear in a text search; with the flag on they
//    appear when the seller typed their exact EAN or SKU.
export function isVisible(
  availability: Availability,
  exactCodeMatch: boolean,
  showUnavailable: boolean,
): boolean {
  switch (availability) {
    case 'AVAILABLE':
      return true;
    case 'NO_PRICE':
      return showUnavailable;
    case 'INACTIVE':
      return showUnavailable && exactCodeMatch;
  }
}
