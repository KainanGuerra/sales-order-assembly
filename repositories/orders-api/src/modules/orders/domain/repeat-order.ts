// Repeating an order, as a pure function: which lines of an old order can be
// ordered again today, and which cannot. Prices are not copied: the new draft is
// priced from the client's current table when it is calculated. Discounts are
// not copied either: they are negotiated per order, and an old one could send
// the new order to approval without the seller noticing.

export type SkipReason = 'UNKNOWN_PRODUCT' | 'DISCONTINUED' | 'NO_PRICE_IN_TABLE';

export interface PastLine {
  productId: string;
  description: string;
  unit: 'UNIT' | 'PACK';
  // The quantity as it was entered (units or packs, per `unit`).
  quantityInput: number;
}

// What the catalog says about a product now.
export interface CurrentProduct {
  productId: string;
  sku: string;
  description: string;
  active: boolean;
  hasPrice: boolean;
  packFactor: number;
  multipleOnly: boolean;
}

export interface RepeatLine {
  productId: string;
  sku: string;
  description: string;
  packFactor: number;
  multipleOnly: boolean;
  quantity: number;
  unit: 'UNIT' | 'PACK';
  discountBp: 0;
}

export interface SkippedLine {
  productId: string;
  description: string;
  reason: SkipReason;
}

export function buildRepeatDraft(
  past: PastLine[],
  current: ReadonlyMap<string, CurrentProduct>,
): { items: RepeatLine[]; skipped: SkippedLine[] } {
  const items: RepeatLine[] = [];
  const skipped: SkippedLine[] = [];

  for (const line of past) {
    const product = current.get(line.productId);
    if (!product) {
      skipped.push({ productId: line.productId, description: line.description, reason: 'UNKNOWN_PRODUCT' });
    } else if (!product.active) {
      skipped.push({ productId: line.productId, description: product.description, reason: 'DISCONTINUED' });
    } else if (!product.hasPrice) {
      skipped.push({ productId: line.productId, description: product.description, reason: 'NO_PRICE_IN_TABLE' });
    } else {
      items.push({
        productId: line.productId,
        sku: product.sku,
        // The description as the catalog has it today.
        description: product.description,
        packFactor: product.packFactor,
        multipleOnly: product.multipleOnly,
        quantity: line.quantityInput,
        unit: line.unit,
        discountBp: 0,
      });
    }
  }
  return { items, skipped };
}
