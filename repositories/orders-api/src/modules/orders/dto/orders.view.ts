import type { ApprovalReason, OrderCalculation, OrderStatus } from '../domain/order-rules.js';

export interface ClientSummary {
  id: string;
  tradeName: string;
  priceTableId: string;
  // True when the client has no table of its own and the default was used.
  priceTableFallback: boolean;
}

// The answer to "what would this order look like": the rule engine's result
// plus the client it was calculated for.
export interface CalculationView extends OrderCalculation {
  client: ClientSummary;
}

export interface OrderItemView {
  productId: string;
  sku: string;
  description: string;
  unit: 'UNIT' | 'PACK';
  quantityInput: number;
  quantityUnits: number;
  packFactor: number;
  unitPriceCents: number;
  discountBp: number;
  grossCents: number;
  netCents: number;
}

export interface OrderView {
  id: string;
  status: OrderStatus;
  sellerId: string;
  clientId: string;
  priceTableId: string;
  subtotalCents: number;
  orderDiscountBp: number;
  orderDiscountCents: number;
  totalCents: number;
  approvalReasons: ApprovalReason[];
  createdAt: string;
  items: OrderItemView[];
}
