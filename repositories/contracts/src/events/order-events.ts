import { z } from 'zod';

// Events published by orders-api on RabbitMQ. Consumers must be idempotent,
// keyed by orderId. Money is in integer cents, discounts in basis points.

export const ORDER_EVENT_PATTERNS = {
  submitted: 'order.submitted',
  approved: 'order.approved',
  rejected: 'order.rejected',
} as const;

// Internal status codes; the UI shows "Enviado" / "Aguardando aprovação".
export const OrderStatusSchema = z.enum(['SUBMITTED', 'AWAITING_APPROVAL']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderSubmittedEventSchema = z.object({
  orderId: z.uuid(),
  clientId: z.string().min(1),
  sellerId: z.string().min(1),
  supervisorId: z.string().min(1),
  status: OrderStatusSchema,
  totalCents: z.number().int().nonnegative(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  submittedAt: z.iso.datetime(),
});
export type OrderSubmittedEvent = z.infer<typeof OrderSubmittedEventSchema>;

export const OrderApprovedEventSchema = z.object({
  orderId: z.uuid(),
  approvedBy: z.string().min(1),
  approvedAt: z.iso.datetime(),
});
export type OrderApprovedEvent = z.infer<typeof OrderApprovedEventSchema>;

export const OrderRejectedEventSchema = z.object({
  orderId: z.uuid(),
  rejectedBy: z.string().min(1),
  reason: z.string().min(1).optional(),
  rejectedAt: z.iso.datetime(),
});
export type OrderRejectedEvent = z.infer<typeof OrderRejectedEventSchema>;
