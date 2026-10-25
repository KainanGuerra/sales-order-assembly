// The life of an order, as pure functions. No I/O: the database applies the
// result with a conditional update, and these functions say what is allowed.
//
//   created (within the limit) .................... SUBMITTED
//   created (outside the limit) ... AWAITING_APPROVAL
//        approve ......... APPROVED, then SUBMITTED   (both recorded, one step)
//        reject .......... REJECTED                    (final)
//
// APPROVED is a step an order passes through, never a state it rests in, so the
// order row only ever holds AWAITING_APPROVAL, SUBMITTED or REJECTED.

export type OrderStatus = 'AWAITING_APPROVAL' | 'APPROVED' | 'SUBMITTED' | 'REJECTED';
export type StoredStatus = 'AWAITING_APPROVAL' | 'SUBMITTED' | 'REJECTED';

export type ApproveDecision =
  | { kind: 'apply'; steps: ['APPROVED', 'SUBMITTED'] }
  // Approving again an order that is already approved is a repeat, not an error.
  | { kind: 'already' }
  | { kind: 'refused'; reason: 'ALREADY_REJECTED' | 'NOT_AWAITING_APPROVAL' };

export type RejectDecision =
  | { kind: 'apply'; steps: ['REJECTED'] }
  | { kind: 'already' }
  | { kind: 'refused'; reason: 'ALREADY_SUBMITTED' };

// `wasApproved` tells an order that went through approval from one that was
// sent straight away: both are SUBMITTED, but only one of them can be "approved again".
export function decideApprove(status: StoredStatus, wasApproved: boolean): ApproveDecision {
  switch (status) {
    case 'AWAITING_APPROVAL':
      return { kind: 'apply', steps: ['APPROVED', 'SUBMITTED'] };
    case 'SUBMITTED':
      return wasApproved ? { kind: 'already' } : { kind: 'refused', reason: 'NOT_AWAITING_APPROVAL' };
    case 'REJECTED':
      return { kind: 'refused', reason: 'ALREADY_REJECTED' };
  }
}

export function decideReject(status: StoredStatus): RejectDecision {
  switch (status) {
    case 'AWAITING_APPROVAL':
      return { kind: 'apply', steps: ['REJECTED'] };
    case 'REJECTED':
      return { kind: 'already' };
    case 'SUBMITTED':
      // Sent (straight away or after an approval): too late to reject.
      return { kind: 'refused', reason: 'ALREADY_SUBMITTED' };
  }
}
