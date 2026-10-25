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
