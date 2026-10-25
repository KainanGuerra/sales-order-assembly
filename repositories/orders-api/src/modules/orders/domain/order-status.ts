// The life of an order, as pure functions. No I/O: the database applies the
// result with a conditional update, and these functions say what is allowed.
//
//   AWAITING_APPROVAL -> APPROVED -> SUBMITTED -> INVOICED
//   AWAITING_APPROVAL -> REJECTED -> CANCELLED
//
//   created within the limit ........ SUBMITTED
//   created outside the limit ....... AWAITING_APPROVAL
//        approve ............ APPROVED, then SUBMITTED   (both recorded, one step)
//        reject ............. REJECTED, then CANCELLED   (both recorded, one step)
//   INVOICED ("Faturado") is set by billing, outside this system; only imported
//   orders have it.
//
// All six are statuses an order can have. A decision carries the order through
// the first two of its chain at once, so after one the order rests at SUBMITTED
// or CANCELLED, and the history keeps every hop.

export type OrderStatus = 'AWAITING_APPROVAL' | 'APPROVED' | 'SUBMITTED' | 'INVOICED' | 'REJECTED' | 'CANCELLED';

export type ApproveDecision =
  | { kind: 'apply'; steps: ['APPROVED', 'SUBMITTED'] }
  // Approving again an order that is already approved is a repeat, not an error.
  | { kind: 'already' }
  | { kind: 'refused'; reason: 'ALREADY_REJECTED' | 'ALREADY_CANCELLED' | 'NOT_AWAITING_APPROVAL' };

export type RejectDecision =
  | { kind: 'apply'; steps: ['REJECTED', 'CANCELLED'] }
  | { kind: 'already' }
  | { kind: 'refused'; reason: 'ALREADY_SUBMITTED' | 'NOT_AWAITING_APPROVAL' };

// `wasApproved` / `wasRejected` tell an order that went through a decision from
// one that did not: the end states look alike (SUBMITTED, CANCELLED), but only
// an order that went through the decision can be "decided again".
export function decideApprove(status: OrderStatus, wasApproved: boolean): ApproveDecision {
  switch (status) {
    case 'AWAITING_APPROVAL':
      return { kind: 'apply', steps: ['APPROVED', 'SUBMITTED'] };
    case 'APPROVED':
    case 'SUBMITTED':
    case 'INVOICED':
      return wasApproved ? { kind: 'already' } : { kind: 'refused', reason: 'NOT_AWAITING_APPROVAL' };
    case 'REJECTED':
      return { kind: 'refused', reason: 'ALREADY_REJECTED' };
    case 'CANCELLED':
      return { kind: 'refused', reason: wasApproved ? 'ALREADY_CANCELLED' : 'ALREADY_REJECTED' };
  }
}

export function decideReject(status: OrderStatus, wasRejected: boolean): RejectDecision {
  switch (status) {
    case 'AWAITING_APPROVAL':
      return { kind: 'apply', steps: ['REJECTED', 'CANCELLED'] };
    case 'REJECTED':
      return { kind: 'already' };
    case 'CANCELLED':
      // Cancelled after a rejection: a repeat. Cancelled some other way: not ours to reject.
      return wasRejected ? { kind: 'already' } : { kind: 'refused', reason: 'NOT_AWAITING_APPROVAL' };
    case 'APPROVED':
    case 'SUBMITTED':
    case 'INVOICED':
      // Sent (straight away or after an approval): too late to reject.
      return { kind: 'refused', reason: 'ALREADY_SUBMITTED' };
  }
}
