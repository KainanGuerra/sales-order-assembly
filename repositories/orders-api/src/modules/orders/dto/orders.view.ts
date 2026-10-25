import type { RejectionReasonCode } from 'contracts';
import type { ApprovalReason, InitialOrderStatus, OrderCalculation } from '../domain/order-rules.js';
import type { OrderStatus } from '../domain/order-status.js';

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

// One line of a client's history.
export interface OrderSummaryView {
  id: string;
  status: OrderStatus;
  origin: 'SYSTEM' | 'IMPORTED';
  totalCents: number;
  itemCount: number;
  createdAt: string;
}

// A draft made from an old order. Nothing is saved: the screen loads it as the
// order being built, and it is calculated like any other.
export interface RepeatDraftView {
  sourceOrderId: string;
  clientId: string;
  items: {
    productId: string;
    sku: string;
    description: string;
    packFactor: number;
    multipleOnly: boolean;
    quantity: number;
    unit: 'UNIT' | 'PACK';
    discountBp: 0;
  }[];
  // The lines of the old order that cannot be ordered again, and why.
  skipped: { productId: string; description: string; reason: 'UNKNOWN_PRODUCT' | 'DISCONTINUED' | 'NO_PRICE_IN_TABLE' }[];
}

export interface HistoryStepView {
  status: OrderStatus;
  actor: string;
  reasonCode: string | null;
  reasonText: string | null;
  at: string;
}

export interface OrderView {
  id: string;
  status: OrderStatus;
  sellerId: string;
  sellerName: string;
  supervisorId: string;
  clientId: string;
  clientTradeName: string;
  priceTableId: string;
  origin: 'SYSTEM' | 'IMPORTED';
  subtotalCents: number;
  orderDiscountBp: number;
  orderDiscountCents: number;
  totalCents: number;
  approvalReasons: ApprovalReason[];
  rejection: { code: RejectionReasonCode; text: string | null } | null;
  createdAt: string;
  items: OrderItemView[];
  history: HistoryStepView[];
}

// One line of the supervisor's list.
export interface PendingOrderView {
  id: string;
  sellerName: string;
  clientTradeName: string;
  totalCents: number;
  // Why it needs approval, as found when the order was sent.
  approvalReasons: ApprovalReason[];
  createdAt: string;
  status: InitialOrderStatus | OrderStatus;
}
