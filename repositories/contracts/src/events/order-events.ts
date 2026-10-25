import { z } from 'zod';

// Events published by orders-api on RabbitMQ. Consumers must be idempotent,
// keyed by orderId. Money is in integer cents, discounts in basis points.
//
// An order's life, and the event for each step:
//   created ............................ order.placed      (always)
//   within the limit ................... then order.submitted (status SUBMITTED)
//   outside the limit .. AWAITING_APPROVAL
//        approved ...................... order.approved, then order.submitted
//        rejected ...................... order.rejected

export const ORDER_EVENT_PATTERNS = {
  placed: 'order.placed',
  submitted: 'order.submitted',
  approved: 'order.approved',
  rejected: 'order.rejected',
} as const;

// Internal status codes; the UI shows "Enviado", "Aguardando aprovação"...
//
//   AWAITING_APPROVAL -> APPROVED -> SUBMITTED -> INVOICED
//   AWAITING_APPROVAL -> REJECTED -> CANCELLED
//
// All six are statuses an order can have. A decision moves an order through the
// first two of its chain at once (approving: APPROVED then SUBMITTED; rejecting:
// REJECTED then CANCELLED), and every hop is recorded. INVOICED ("Faturado") is
// set by billing, which is outside this system: only imported orders have it.
// "Faturado" and "Cancelado" are the words the seed's history orders use.
export const OrderStatusSchema = z.enum(['AWAITING_APPROVAL', 'APPROVED', 'SUBMITTED', 'INVOICED', 'REJECTED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

// The two states an order can be in the moment it is created.
export const InitialOrderStatusSchema = z.enum(['SUBMITTED', 'AWAITING_APPROVAL']);
export type InitialOrderStatus = z.infer<typeof InitialOrderStatusSchema>;

// Who an order is about, carried by every event so a consumer can address a
// message (to the seller, to the supervisor) and write it (the client's name,
// the amount) without calling another service.
const OrderRefShape = {
  orderId: z.uuid(),
  sellerId: z.string().min(1),
  supervisorId: z.string().min(1),
  clientId: z.string().min(1),
  clientTradeName: z.string().min(1),
  totalCents: z.number().int().nonnegative(),
};

const OrderItemsSchema = z
  .array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
    }),
  )
  .min(1);

// The order was created. Credit stays held for it; a supervisor is told when it
// is waiting for approval.
export const OrderPlacedEventSchema = z.object({
  ...OrderRefShape,
  status: InitialOrderStatusSchema,
  items: OrderItemsSchema,
  placedAt: z.iso.datetime(),
});
export type OrderPlacedEvent = z.infer<typeof OrderPlacedEventSchema>;

// The order reached SUBMITTED: sent straight away, or after an approval.
export const OrderSubmittedEventSchema = z.object({
  ...OrderRefShape,
  items: OrderItemsSchema,
  submittedAt: z.iso.datetime(),
});
export type OrderSubmittedEvent = z.infer<typeof OrderSubmittedEventSchema>;

export const OrderApprovedEventSchema = z.object({
  ...OrderRefShape,
  approvedBy: z.string().min(1),
  approvedAt: z.iso.datetime(),
});
export type OrderApprovedEvent = z.infer<typeof OrderApprovedEventSchema>;

// Why a supervisor rejects an order: one of these, and for OTHER a text.
export const REJECTION_REASON_CODES = [
  'DISCOUNT_TOO_HIGH',
  'CREDIT_RISK',
  'PRODUCT_OR_QUANTITY',
  'ORDER_DATA_WRONG',
  'OTHER',
] as const;
export const RejectionReasonCodeSchema = z.enum(REJECTION_REASON_CODES);
export type RejectionReasonCode = z.infer<typeof RejectionReasonCodeSchema>;

export const OrderRejectedEventSchema = z.object({
  ...OrderRefShape,
  rejectedBy: z.string().min(1),
  reasonCode: RejectionReasonCodeSchema,
  // Required when the code is OTHER.
  reasonText: z.string().min(1).optional(),
  rejectedAt: z.iso.datetime(),
});
export type OrderRejectedEvent = z.infer<typeof OrderRejectedEventSchema>;
