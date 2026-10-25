// Shapes of the answers the BFF gives the browser. Written by hand for now;
// they mirror the backend services (see DECISIONS.md on how they are kept in step).

export type Role = 'SELLER' | 'SUPERVISOR';

export interface SessionUser {
  role: Role;
  id: string;
  name: string;
  supervisorId?: string;
  discountLimitBp?: number;
}

export interface LoginOptions {
  supervisors: { id: string; name: string }[];
  sellers: { id: string; name: string }[];
}

export interface ClientView {
  id: string;
  tradeName: string;
  legalName: string;
  cnpj: string;
  city: string;
  state: string;
  sellerId: string;
  priceTableId: string;
  priceTableFallback: boolean;
  creditLimitCents: number;
  creditUsedCents: number;
  creditAvailableCents: number;
}

export type Availability = 'AVAILABLE' | 'NO_PRICE' | 'INACTIVE';
export type UnavailableReason = 'DISCONTINUED' | 'NO_PRICE_IN_TABLE';

export interface ProductSearchItem {
  id: string;
  sku: string;
  ean: string;
  description: string;
  saleUnit: string;
  packFactor: number;
  multipleOnly: boolean;
  availability: Availability;
  unitPriceCents: number | null;
  reason: UnavailableReason | null;
}

export type QuantityUnit = 'UNIT' | 'PACK';
// What an order can be:
//   AWAITING_APPROVAL -> APPROVED -> SUBMITTED -> INVOICED
//   AWAITING_APPROVAL -> REJECTED -> CANCELLED
// A decision carries the order through the first two of its chain at once.
// INVOICED ("Faturado") and CANCELLED ("Cancelado") are also the words of the
// orders that came with the seed.
export type OrderStatus = 'AWAITING_APPROVAL' | 'APPROVED' | 'SUBMITTED' | 'INVOICED' | 'REJECTED' | 'CANCELLED';
export type InitialOrderStatus = 'SUBMITTED' | 'AWAITING_APPROVAL';

export const REJECTION_REASON_CODES = ['DISCOUNT_TOO_HIGH', 'CREDIT_RISK', 'PRODUCT_OR_QUANTITY', 'ORDER_DATA_WRONG', 'OTHER'] as const;
export type RejectionReasonCode = (typeof REJECTION_REASON_CODES)[number];

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
  quantityUnits: number | null;
  packFactor: number | null;
  unitPriceCents: number | null;
  grossCents: number | null;
  discountBp: number;
  netCents: number | null;
  blockers: LineBlocker[];
}

export interface Calculation {
  lines: CalculatedLine[];
  subtotalCents: number;
  orderDiscountBp: number;
  orderDiscountCents: number;
  totalCents: number;
  minimumOrderCents: number;
  availableCreditCents: number;
  effectiveDiscountLimitBp: number;
  blockers: OrderBlocker[];
  approvalReasons: ApprovalReason[];
  status: InitialOrderStatus;
  canSubmit: boolean;
  client: { id: string; tradeName: string; priceTableId: string; priceTableFallback: boolean };
}

export interface OrderItemView {
  productId: string;
  sku: string;
  description: string;
  unit: QuantityUnit;
  quantityInput: number;
  quantityUnits: number;
  packFactor: number;
  unitPriceCents: number;
  discountBp: number;
  grossCents: number;
  netCents: number;
}

export interface HistoryStep {
  status: OrderStatus;
  // user:<id> or system:<name>
  actor: string;
  reasonCode: string | null;
  reasonText: string | null;
  at: string;
}

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  origin: 'SYSTEM' | 'IMPORTED';
  totalCents: number;
  itemCount: number;
  createdAt: string;
}

export type SkipReason = 'UNKNOWN_PRODUCT' | 'DISCONTINUED' | 'NO_PRICE_IN_TABLE';

export interface SkippedLine {
  productId: string;
  description: string;
  reason: SkipReason;
}

export interface RepeatDraft {
  sourceOrderId: string;
  clientId: string;
  items: {
    productId: string;
    sku: string;
    description: string;
    packFactor: number;
    multipleOnly: boolean;
    quantity: number;
    unit: QuantityUnit;
    discountBp: 0;
  }[];
  skipped: SkippedLine[];
}

export interface PendingOrder {
  id: string;
  sellerName: string;
  clientTradeName: string;
  totalCents: number;
  approvalReasons: ApprovalReason[];
  createdAt: string;
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
  history: HistoryStep[];
}

export type NotificationKind = 'APPROVAL_NEEDED' | 'ORDER_AWAITING_APPROVAL' | 'ORDER_SENT' | 'ORDER_APPROVED' | 'ORDER_CANCELLED';

export interface NotificationView {
  id: string;
  kind: NotificationKind;
  orderId: string;
  data: {
    clientTradeName: string;
    totalCents: number;
    decidedBy?: string;
    reasonCode?: RejectionReasonCode;
    reasonText?: string;
  };
  createdAt: string;
  read: boolean;
  // The decision it asked for, or waited on, was made.
  resolved: boolean;
}
