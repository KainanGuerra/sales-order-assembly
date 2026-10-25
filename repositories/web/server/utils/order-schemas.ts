import { z } from 'zod';

// Shape checks only, to stop junk early. Whether a quantity or a discount is
// acceptable is decided by orders, and its reasons come back in the answer.
const LineSchema = z.object({
  productId: z.string().trim().min(1).max(40),
  quantity: z.number(),
  unit: z.enum(['UNIT', 'PACK']),
  discountBp: z.number(),
});

export const OrderDraftSchema = z.object({
  clientId: z.string().trim().min(1).max(40),
  items: z.array(LineSchema).max(200),
  orderDiscountBp: z.number(),
});

export const SubmitOrderSchema = OrderDraftSchema.extend({ orderId: z.uuid() });

// Why a supervisor rejects an order: one of the listed reasons, and for "other"
// a text. The orders service checks it again; this stops junk early.
export const REJECTION_REASON_CODES = ['DISCOUNT_TOO_HIGH', 'CREDIT_RISK', 'PRODUCT_OR_QUANTITY', 'ORDER_DATA_WRONG', 'OTHER'] as const;

export const RejectOrderSchema = z
  .object({
    reasonCode: z.enum(REJECTION_REASON_CODES),
    reasonText: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.reasonCode !== 'OTHER' || (value.reasonText?.length ?? 0) >= 3, {
    message: 'Describe the reason (at least 3 characters)',
    path: ['reasonText'],
  });
