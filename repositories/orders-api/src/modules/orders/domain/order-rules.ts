// The business rules of an order, as pure functions: plain data in, plain data
// out, no I/O. Everything the seller can be blocked by, and everything that
// sends an order to approval, is decided here.
//
// Units of measure:
//  - money is integer cents;
//  - discounts are integer basis points (1% = 100);
//  - quantities are integer units (a pack is converted using its pack factor).

export type QuantityUnit = 'UNIT' | 'PACK';
export type OrderStatus = 'SUBMITTED' | 'AWAITING_APPROVAL';

export interface CatalogProduct {
  productId: string;
  description: string;
  active: boolean;
  packFactor: number;
  multipleOnly: boolean;
  hasPrice: boolean;
  unitPriceCents: number;
}

export interface OrderLineInput {
  productId: string;
  quantity: number;
  unit: QuantityUnit;
  discountBp: number;
}

export interface OrderInput {
  items: OrderLineInput[];
  orderDiscountBp: number;
}

export interface OrderPolicy {
  // The discount limit of the seller (alçada), in basis points.
  sellerDiscountLimitBp: number;
  // Global ceiling. The effective limit is the smaller of this and the seller's.
  maxDiscountBp: number;
  // Orders below this net total cannot be sent.
  minimumOrderCents: number;
  // Credit the client still has: the limit minus what is spoken for. An order
  // worth more than this cannot be sent.
  availableCreditCents: number;
}

export type LineBlocker =
  | 'UNKNOWN_PRODUCT'
  | 'PRODUCT_INACTIVE'
  | 'NO_PRICE'
  | 'DUPLICATE_PRODUCT'
  | 'INVALID_QUANTITY'
  | 'PACK_NOT_AVAILABLE'
  | 'NOT_PACK_MULTIPLE'
  | 'INVALID_DISCOUNT';

export type OrderBlocker = 'EMPTY_ORDER' | 'INVALID_ORDER_DISCOUNT' | 'BELOW_MINIMUM' | 'CREDIT_EXCEEDED';

export type ApprovalReason =
  | { code: 'LINE_DISCOUNT_ABOVE_LIMIT'; productId: string; discountBp: number }
  | { code: 'ORDER_DISCOUNT_ABOVE_LIMIT'; discountBp: number };

export interface CalculatedLine {
  productId: string;
  description: string | null;
  unit: QuantityUnit;
  quantityInput: number;
  // Null when the quantity is invalid or the unit does not apply.
  quantityUnits: number | null;
  packFactor: number | null;
  unitPriceCents: number | null;
  grossCents: number | null;
  discountBp: number;
  // Line total after the line discount. Null when it cannot be computed.
  netCents: number | null;
  blockers: LineBlocker[];
}

export interface OrderCalculation {
  lines: CalculatedLine[];
  // Sum of the line totals that could be computed.
  subtotalCents: number;
  orderDiscountBp: number;
  orderDiscountCents: number;
  // What the client pays: subtotal minus the order discount.
  totalCents: number;
  minimumOrderCents: number;
  availableCreditCents: number;
  effectiveDiscountLimitBp: number;
  blockers: OrderBlocker[];
  approvalReasons: ApprovalReason[];
  // Where the order would go if it were sent.
  status: OrderStatus;
  canSubmit: boolean;
}

export const MAX_DISCOUNT_BP = 10_000; // 100%
export const MAX_QUANTITY_UNITS = 100_000;

// n / d rounded half up, for non-negative integers.
export function divideRoundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

const isValidDiscount = (bp: number) => Number.isInteger(bp) && bp >= 0 && bp <= MAX_DISCOUNT_BP;

export function calculateOrder(
  input: OrderInput,
  products: ReadonlyMap<string, CatalogProduct>,
  policy: OrderPolicy,
): OrderCalculation {
  const occurrences = new Map<string, number>();
  for (const item of input.items) {
    occurrences.set(item.productId, (occurrences.get(item.productId) ?? 0) + 1);
  }

  const lines = input.items.map((item) =>
    calculateLine(item, products.get(item.productId), (occurrences.get(item.productId) ?? 0) > 1),
  );

  const subtotalCents = lines.reduce((sum, line) => sum + (line.netCents ?? 0), 0);

  const orderDiscountValid = isValidDiscount(input.orderDiscountBp);
  const orderDiscountCents = orderDiscountValid
    ? divideRoundHalfUp(subtotalCents * input.orderDiscountBp, MAX_DISCOUNT_BP)
    : 0;
  const totalCents = subtotalCents - orderDiscountCents;

  const blockers: OrderBlocker[] = [];
  if (input.items.length === 0) {
    blockers.push('EMPTY_ORDER');
  }
  if (!orderDiscountValid) {
    blockers.push('INVALID_ORDER_DISCOUNT');
  }
  if (input.items.length > 0 && totalCents < policy.minimumOrderCents) {
    blockers.push('BELOW_MINIMUM');
  }
  // Measured on what the client pays, like the minimum. Exactly the credit left is allowed.
  if (input.items.length > 0 && totalCents > policy.availableCreditCents) {
    blockers.push('CREDIT_EXCEEDED');
  }

  const effectiveDiscountLimitBp = Math.min(policy.sellerDiscountLimitBp, policy.maxDiscountBp);
  const approvalReasons: ApprovalReason[] = [];
  for (const line of lines) {
    if (!line.blockers.includes('INVALID_DISCOUNT') && line.discountBp > effectiveDiscountLimitBp) {
      approvalReasons.push({ code: 'LINE_DISCOUNT_ABOVE_LIMIT', productId: line.productId, discountBp: line.discountBp });
    }
  }
  if (orderDiscountValid && input.orderDiscountBp > effectiveDiscountLimitBp) {
    approvalReasons.push({ code: 'ORDER_DISCOUNT_ABOVE_LIMIT', discountBp: input.orderDiscountBp });
  }

  const hasBlockers = blockers.length > 0 || lines.some((line) => line.blockers.length > 0);

  return {
    lines,
    subtotalCents,
    orderDiscountBp: input.orderDiscountBp,
    orderDiscountCents,
    totalCents,
    minimumOrderCents: policy.minimumOrderCents,
    availableCreditCents: policy.availableCreditCents,
    effectiveDiscountLimitBp,
    blockers,
    approvalReasons,
    status: approvalReasons.length > 0 ? 'AWAITING_APPROVAL' : 'SUBMITTED',
    canSubmit: !hasBlockers,
  };
}

function calculateLine(
  item: OrderLineInput,
  product: CatalogProduct | undefined,
  duplicated: boolean,
): CalculatedLine {
  const blockers: LineBlocker[] = [];
  const base: CalculatedLine = {
    productId: item.productId,
    description: product?.description ?? null,
    unit: item.unit,
    quantityInput: item.quantity,
    quantityUnits: null,
    packFactor: product?.packFactor ?? null,
    unitPriceCents: null,
    grossCents: null,
    discountBp: item.discountBp,
    netCents: null,
    blockers,
  };

  if (duplicated) {
    blockers.push('DUPLICATE_PRODUCT');
  }
  if (!isValidDiscount(item.discountBp)) {
    blockers.push('INVALID_DISCOUNT');
  }
  if (!product) {
    blockers.push('UNKNOWN_PRODUCT');
    return base;
  }
  if (!product.active) {
    blockers.push('PRODUCT_INACTIVE');
  } else if (!product.hasPrice) {
    blockers.push('NO_PRICE');
  }

  const units = toUnits(item, product, blockers);
  base.quantityUnits = units;

  const priced = product.active && product.hasPrice;
  if (priced) {
    base.unitPriceCents = product.unitPriceCents;
  }
  if (units !== null && priced) {
    base.grossCents = product.unitPriceCents * units;
    if (!blockers.includes('INVALID_DISCOUNT')) {
      base.netCents = divideRoundHalfUp(base.grossCents * (MAX_DISCOUNT_BP - item.discountBp), MAX_DISCOUNT_BP);
    }
  }
  return base;
}

// Converts the entered quantity to units and checks the pack rules.
// Returns null (with a blocker recorded) when the quantity cannot be used.
function toUnits(item: OrderLineInput, product: CatalogProduct, blockers: LineBlocker[]): number | null {
  if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
    blockers.push('INVALID_QUANTITY');
    return null;
  }
  if (item.unit === 'PACK' && product.packFactor <= 1) {
    blockers.push('PACK_NOT_AVAILABLE');
    return null;
  }
  const units = item.unit === 'PACK' ? item.quantity * product.packFactor : item.quantity;
  if (units > MAX_QUANTITY_UNITS) {
    blockers.push('INVALID_QUANTITY');
    return null;
  }
  if (product.multipleOnly && units % product.packFactor !== 0) {
    blockers.push('NOT_PACK_MULTIPLE');
    return units;
  }
  return units;
}
